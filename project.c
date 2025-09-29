#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <limits.h>

#define MAX_EVENTS 1000
#define MAX_TIME_SLOTS 48
#define MAX_COLORS 20
#define HASH_SIZE 997  // Prime number for hash table

// Hash table node for O(1) event lookup
typedef struct HashNode {
    int event_id;
    int event_index;
    struct HashNode* next;
} HashNode;

// Time slot structure
typedef struct {
    int start_hour;
    int start_minute;
    int end_hour;
    int end_minute;
} TimeSlot;

// Event structure with optimization flags
typedef struct {
    int id;
    char name[50];
    TimeSlot time;
    int duration_minutes;
    int color;
    bool scheduled;
    int priority;
    int degree;  // Precomputed degree for sorting
} Event;

// Optimized graph node using adjacency list only
typedef struct AdjListNode {
    int event_index;
    struct AdjListNode* next;
} AdjListNode;

// Optimized conflict graph structure
typedef struct {
    AdjListNode* adjacency_list[MAX_EVENTS];
    int num_events;
    HashNode* event_hash[HASH_SIZE];  // Hash table for O(1) event lookup
} ConflictGraph;

// Global variables
Event events[MAX_EVENTS];
ConflictGraph conflict_graph;
int num_events = 0;
int next_event_id = 1;

// Optimization: Hash function for O(1) event lookup
unsigned int hash_function(int event_id) {
    return event_id % HASH_SIZE;
}

// Add event to hash table for O(1) lookup
void hash_insert(int event_id, int event_index) {
    unsigned int hash_key = hash_function(event_id);
    HashNode* new_node = (HashNode*)malloc(sizeof(HashNode));
    new_node->event_id = event_id;
    new_node->event_index = event_index;
    new_node->next = conflict_graph.event_hash[hash_key];
    conflict_graph.event_hash[hash_key] = new_node;
}

// Find event index by ID in O(1) time
int find_event_index(int event_id) {
    unsigned int hash_key = hash_function(event_id);
    HashNode* current = conflict_graph.event_hash[hash_key];
    
    while (current != NULL) {
        if (current->event_id == event_id) {
            return current->event_index;
        }
        current = current->next;
    }
    return -1;  // Not found
}

// Remove from hash table
void hash_remove(int event_id) {
    unsigned int hash_key = hash_function(event_id);
    HashNode* current = conflict_graph.event_hash[hash_key];
    HashNode* prev = NULL;
    
    while (current != NULL) {
        if (current->event_id == event_id) {
            if (prev == NULL) {
                conflict_graph.event_hash[hash_key] = current->next;
            } else {
                prev->next = current->next;
            }
            free(current);
            return;
        }
        prev = current;
        current = current->next;
    }
}

// Initialize optimized graph
void initialize_graph() {
    conflict_graph.num_events = 0;
    for (int i = 0; i < MAX_EVENTS; i++) {
        conflict_graph.adjacency_list[i] = NULL;
    }
    for (int i = 0; i < HASH_SIZE; i++) {
        conflict_graph.event_hash[i] = NULL;
    }
}

// Optimized time conflict check (same logic, better naming)
bool check_time_conflict(TimeSlot t1, TimeSlot t2) {
    int t1_start = t1.start_hour * 60 + t1.start_minute;
    int t1_end = t1.end_hour * 60 + t1.end_minute;
    int t2_start = t2.start_hour * 60 + t2.start_minute;
    int t2_end = t2.end_hour * 60 + t2.end_minute;
    
    return !(t1_end <= t2_start || t2_end <= t1_start);
}

// Merge sort for O(n log n) sorting instead of O(n²) bubble sort
void merge_events_by_degree(Event arr[], int left, int mid, int right) {
    int i, j, k;
    int n1 = mid - left + 1;
    int n2 = right - mid;
    
    Event L[n1], R[n2];
    
    for (i = 0; i < n1; i++)
        L[i] = arr[left + i];
    for (j = 0; j < n2; j++)
        R[j] = arr[mid + 1 + j];
    
    i = 0; j = 0; k = left;
    while (i < n1 && j < n2) {
        if (L[i].degree >= R[j].degree) {  // Descending order
            arr[k] = L[i];
            i++;
        } else {
            arr[k] = R[j];
            j++;
        }
        k++;
    }
    
    while (i < n1) {
        arr[k] = L[i];
        i++; k++;
    }
    while (j < n2) {
        arr[k] = R[j];
        j++; k++;
    }
}

void merge_sort_by_degree(Event arr[], int left, int right) {
    if (left < right) {
        int mid = left + (right - left) / 2;
        merge_sort_by_degree(arr, left, mid);
        merge_sort_by_degree(arr, mid + 1, right);
        merge_events_by_degree(arr, left, mid, right);
    }
}

// Merge sort for priority scheduling
void merge_events_by_priority(Event arr[], int left, int mid, int right) {
    int i, j, k;
    int n1 = mid - left + 1;
    int n2 = right - mid;
    
    Event L[n1], R[n2];
    
    for (i = 0; i < n1; i++)
        L[i] = arr[left + i];
    for (j = 0; j < n2; j++)
        R[j] = arr[mid + 1 + j];
    
    i = 0; j = 0; k = left;
    while (i < n1 && j < n2) {
        bool should_place_L = false;
        
        if (L[i].priority > R[j].priority) {
            should_place_L = true;
        } else if (L[i].priority == R[j].priority) {
            int time1 = L[i].time.start_hour * 60 + L[i].time.start_minute;
            int time2 = R[j].time.start_hour * 60 + R[j].time.start_minute;
            if (time1 <= time2) {
                should_place_L = true;
            }
        }
        
        if (should_place_L) {
            arr[k] = L[i];
            i++;
        } else {
            arr[k] = R[j];
            j++;
        }
        k++;
    }
    
    while (i < n1) {
        arr[k] = L[i];
        i++; k++;
    }
    while (j < n2) {
        arr[k] = R[j];
        j++; k++;
    }
}

void merge_sort_by_priority(Event arr[], int left, int right) {
    if (left < right) {
        int mid = left + (right - left) / 2;
        merge_sort_by_priority(arr, left, mid);
        merge_sort_by_priority(arr, mid + 1, right);
        merge_events_by_priority(arr, left, mid, right);
    }
}

// Optimized graph building - precompute degrees
void build_conflict_graph() {
    initialize_graph();
    conflict_graph.num_events = num_events;
    
    // Initialize degrees to 0
    for (int i = 0; i < num_events; i++) {
        events[i].degree = 0;
    }
    
    // Build adjacency list and count degrees in single pass
    for (int i = 0; i < num_events; i++) {
        for (int j = i + 1; j < num_events; j++) {
            if (check_time_conflict(events[i].time, events[j].time)) {
                // Add edge i -> j
                AdjListNode* node1 = (AdjListNode*)malloc(sizeof(AdjListNode));
                node1->event_index = j;
                node1->next = conflict_graph.adjacency_list[i];
                conflict_graph.adjacency_list[i] = node1;
                
                // Add edge j -> i
                AdjListNode* node2 = (AdjListNode*)malloc(sizeof(AdjListNode));
                node2->event_index = i;
                node2->next = conflict_graph.adjacency_list[j];
                conflict_graph.adjacency_list[j] = node2;
                
                // Increment degrees
                events[i].degree++;
                events[j].degree++;
            }
        }
    }
}

// Optimized Welsh-Powell using merge sort O(n log n)
void welsh_powell_coloring() {
    if (num_events == 0) return;
    
    // Create temporary array for sorting
    Event temp_events[MAX_EVENTS];
    for (int i = 0; i < num_events; i++) {
        temp_events[i] = events[i];
    }
    
    // Sort by degree using merge sort - O(n log n)
    merge_sort_by_degree(temp_events, 0, num_events - 1);
    
    // Initialize colors
    for (int i = 0; i < num_events; i++) {
        events[i].color = -1;
    }
    
    // Color each event in sorted order
    for (int i = 0; i < num_events; i++) {
        int event_index = -1;
        // Find the original index of this event
        for (int j = 0; j < num_events; j++) {
            if (events[j].id == temp_events[i].id) {
                event_index = j;
                break;
            }
        }
        
        if (event_index == -1) continue;
        
        int color = 0;
        bool color_used[MAX_COLORS] = {false};
        
        // Check colors of neighbors - O(degree)
        AdjListNode* current = conflict_graph.adjacency_list[event_index];
        while (current != NULL) {
            if (events[current->event_index].color != -1) {
                color_used[events[current->event_index].color] = true;
            }
            current = current->next;
        }
        
        // Find first available color
        while (color < MAX_COLORS && color_used[color]) {
            color++;
        }
        
        events[event_index].color = color;
    }
}

// Optimized greedy scheduling using merge sort
void greedy_interval_scheduling() {
    if (num_events == 0) return;
    
    // Sort by priority and start time using merge sort - O(n log n)
    merge_sort_by_priority(events, 0, num_events - 1);
    
    // Mark all as unscheduled
    for (int i = 0; i < num_events; i++) {
        events[i].scheduled = false;
    }
    
    // Schedule greedily - O(n²) in worst case but better in practice
    for (int i = 0; i < num_events; i++) {
        bool can_schedule = true;
        
        // Check conflicts only with already scheduled events
        for (int j = 0; j < i; j++) {
            if (events[j].scheduled && 
                check_time_conflict(events[i].time, events[j].time)) {
                can_schedule = false;
                break;
            }
        }
        
        events[i].scheduled = can_schedule;
    }
}

// Add event with hash table optimization
void add_event(char* name, int start_hour, int start_minute, int duration_minutes, int priority) {
    if (num_events >= MAX_EVENTS) {
        printf("Cannot add more events. Maximum capacity reached.\n");
        return;
    }
    
    Event new_event;
    new_event.id = next_event_id++;
    strcpy(new_event.name, name);
    new_event.time.start_hour = start_hour;
    new_event.time.start_minute = start_minute;
    new_event.duration_minutes = duration_minutes;
    
    // Calculate end time
    int total_minutes = start_hour * 60 + start_minute + duration_minutes;
    new_event.time.end_hour = total_minutes / 60;
    new_event.time.end_minute = total_minutes % 60;
    
    new_event.color = -1;
    new_event.scheduled = false;
    new_event.priority = priority;
    new_event.degree = 0;
    
    events[num_events] = new_event;
    
    // Add to hash table for O(1) lookup
    hash_insert(new_event.id, num_events);
    
    num_events++;
    
    printf("Event '%s' added successfully with ID: %d\n", name, new_event.id);
    
    // Rebuild and reschedule
    build_conflict_graph();
    dynamic_reschedule();
}

// Optimized remove event using hash table
void remove_event(int event_id) {
    int index = find_event_index(event_id);
    
    if (index == -1) {
        printf("Event with ID %d not found.\n", event_id);
        return;
    }
    
    printf("Removing event '%s' (ID: %d)\n", events[index].name, event_id);
    
    // Remove from hash table
    hash_remove(event_id);
    
    // Shift remaining events
    for (int i = index; i < num_events - 1; i++) {
        events[i] = events[i + 1];
    }
    num_events--;
    
    // Update hash table indices
    for (int i = 0; i < HASH_SIZE; i++) {
        HashNode* current = conflict_graph.event_hash[i];
        while (current != NULL) {
            if (current->event_index > index) {
                current->event_index--;
            }
            current = current->next;
        }
    }
    
    // Rebuild and reschedule
    build_conflict_graph();
    dynamic_reschedule();
}

// Helper functions remain largely the same but optimized where possible
int get_time_slot(int hour, int minute) {
    return (hour * 60 + minute) / 30;
}

TimeSlot get_time_from_slot(int slot) {
    TimeSlot time;
    int total_minutes = slot * 30;
    time.start_hour = total_minutes / 60;
    time.start_minute = total_minutes % 60;
    time.end_hour = (total_minutes + 30) / 60;
    time.end_minute = (total_minutes + 30) % 60;
    return time;
}

bool can_schedule_at_time(int event_id, TimeSlot time) {
    for (int i = 0; i < num_events; i++) {
        if (events[i].id != event_id && events[i].scheduled && 
            check_time_conflict(time, events[i].time)) {
            return false;
        }
    }
    return true;
}

void dynamic_reschedule() {
    printf("\n=== DYNAMIC RESCHEDULING ===\n");
    
    greedy_interval_scheduling();
    
    int unscheduled_count = 0;
    for (int i = 0; i < num_events; i++) {
        if (!events[i].scheduled) {
            unscheduled_count++;
        }
    }
    
    if (unscheduled_count > 0) {
        printf("Warning: %d events could not be scheduled due to conflicts!\n", unscheduled_count);
        
        welsh_powell_coloring();
        
        // Try alternative scheduling for unscheduled events
        for (int i = 0; i < num_events; i++) {
            if (!events[i].scheduled) {
                bool rescheduled = false;
                for (int slot = 0; slot < MAX_TIME_SLOTS - (events[i].duration_minutes / 30); slot++) {
                    TimeSlot alternative_time = get_time_from_slot(slot);
                    alternative_time.end_hour = (alternative_time.start_hour * 60 + 
                                               alternative_time.start_minute + 
                                               events[i].duration_minutes) / 60;
                    alternative_time.end_minute = (alternative_time.start_hour * 60 + 
                                                  alternative_time.start_minute + 
                                                  events[i].duration_minutes) % 60;
                    
                    if (can_schedule_at_time(events[i].id, alternative_time)) {
                        events[i].time = alternative_time;
                        events[i].scheduled = true;
                        events[i].color = slot;
                        printf("Rescheduled '%s' to alternative time: %02d:%02d-%02d:%02d\n", 
                               events[i].name, alternative_time.start_hour, alternative_time.start_minute,
                               alternative_time.end_hour, alternative_time.end_minute);
                        rescheduled = true;
                        break;
                    }
                }
                
                if (!rescheduled) {
                    printf("Could not find alternative time slot for '%s'\n", events[i].name);
                }
            }
        }
    }
    
    printf("Rescheduling complete.\n");
    printf("========================\n\n");
}

void print_graph() {
    printf("\n=== CONFLICT GRAPH ===\n");
    for (int i = 0; i < num_events; i++) {
        printf("Event %d (%s, degree=%d): ", events[i].id, events[i].name, events[i].degree);
        AdjListNode* current = conflict_graph.adjacency_list[i];
        while (current != NULL) {
            printf("%d ", events[current->event_index].id);
            current = current->next;
        }
        printf("\n");
    }
    printf("====================\n\n");
}

void print_schedule() {
    printf("\n=== CURRENT SCHEDULE ===\n");
    printf("%-4s %-20s %-12s %-8s %-8s %-10s\n", 
           "ID", "Event Name", "Time", "Duration", "Priority", "Status");
    printf("------------------------------------------------------------\n");
    
    for (int i = 0; i < num_events; i++) {
        printf("%-4d %-20s %02d:%02d-%02d:%02d %-8d %-8d %-10s\n",
               events[i].id,
               events[i].name,
               events[i].time.start_hour, events[i].time.start_minute,
               events[i].time.end_hour, events[i].time.end_minute,
               events[i].duration_minutes,
               events[i].priority,
               events[i].scheduled ? "Scheduled" : "Unscheduled");
    }
    printf("========================================\n\n");
}

void print_events() {
    printf("\n=== ALL EVENTS ===\n");
    for (int i = 0; i < num_events; i++) {
        printf("ID: %d, Name: %s, Time: %02d:%02d-%02d:%02d, Duration: %d min, Priority: %d\n",
               events[i].id, events[i].name,
               events[i].time.start_hour, events[i].time.start_minute,
               events[i].time.end_hour, events[i].time.end_minute,
               events[i].duration_minutes, events[i].priority);
    }
    printf("==================\n\n");
}

void print_menu() {
    printf("\n=== OPTIMIZED DYNAMIC EVENT SCHEDULER ===\n");
    printf("1. Add Event\n");
    printf("2. Remove Event\n");
    printf("3. View Schedule\n");
    printf("4. View All Events\n");
    printf("5. View Conflict Graph\n");
    printf("6. Manual Reschedule\n");
    printf("7. Exit\n");
    printf("Enter your choice: ");
}

int main() {
    printf("Welcome to Optimized Dynamic Event Scheduler!\n");
    printf("This program demonstrates OPTIMIZED:\n");
    printf("- Graph Coloring (Welsh-Powell with Merge Sort)\n");
    printf("- Greedy Interval Scheduling (with Merge Sort)\n");
    printf("- Hash Table for O(1) Event Lookup\n");
    printf("- Adjacency List instead of Matrix\n");
    printf("- Precomputed Degrees\n\n");
    
    initialize_graph();
    
    // Add sample events
    add_event("Math Class", 9, 0, 60, 3);
    add_event("Physics Lab", 10, 0, 90, 4);
    add_event("Lunch Break", 12, 0, 30, 2);
    add_event("Study Group", 14, 0, 120, 3);
    add_event("Team Meeting", 16, 0, 45, 5);
    
    int choice;
    do {
        print_menu();
        scanf("%d", &choice);
        
        switch (choice) {
            case 1: {
                char name[50];
                int start_hour, start_minute, duration, priority;
                
                printf("Enter event name: ");
                scanf(" %[^\n]", name);
                printf("Enter start time (hour minute): ");
                scanf("%d %d", &start_hour, &start_minute);
                printf("Enter duration in minutes: ");
                scanf("%d", &duration);
                printf("Enter priority (1-5, 5=highest): ");
                scanf("%d", &priority);
                
                add_event(name, start_hour, start_minute, duration, priority);
                break;
            }
            case 2: {
                int event_id;
                printf("Enter event ID to remove: ");
                scanf("%d", &event_id);
                remove_event(event_id);
                break;
            }
            case 3:
                print_schedule();
                break;
            case 4:
                print_events();
                break;
            case 5:
                print_graph();
                break;
            case 6:
                dynamic_reschedule();
                break;
            case 7:
                printf("Thank you for using Optimized Dynamic Event Scheduler!\n");
                break;
            default:
                printf("Invalid choice. Please try again.\n");
        }
    } while (choice != 7);
    
    return 0;
}