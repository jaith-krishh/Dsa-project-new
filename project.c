#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <limits.h>

#define MAX_EVENTS 100
#define MAX_TIME_SLOTS 48  // 30-minute slots for 24 hours
#define MAX_COLORS 20

// Structure to represent a time slot
typedef struct {
    int start_hour;
    int start_minute;
    int end_hour;
    int end_minute;
} TimeSlot;

// Structure to represent an event
typedef struct {
    int id;
    char name[50];
    TimeSlot time;
    int duration_minutes;
    int color;  // Used for graph coloring (represents time slot)
    bool scheduled;
    int priority;  // Higher number = higher priority
} Event;

// Graph node structure
typedef struct GraphNode {
    int event_id;
    struct GraphNode* next;
} GraphNode;

// Graph structure for conflict detection
typedef struct {
    GraphNode* adjacency_list[MAX_EVENTS];
    int num_events;
    bool conflicts[MAX_EVENTS][MAX_EVENTS];
} ConflictGraph;

// Global variables
Event events[MAX_EVENTS];
ConflictGraph conflict_graph;
int num_events = 0;
int next_event_id = 1;

// Function prototypes
void initialize_graph();
bool check_time_conflict(TimeSlot t1, TimeSlot t2);
void add_event(char* name, int start_hour, int start_minute, int duration_minutes, int priority);
void remove_event(int event_id);
void build_conflict_graph();
void print_graph();
void welsh_powell_coloring();
void greedy_interval_scheduling();
void schedule_event(int event_id, int time_slot);
void print_schedule();
void print_events();
int get_time_slot(int hour, int minute);
TimeSlot get_time_from_slot(int slot);
void dynamic_reschedule();
bool can_schedule_at_time(int event_id, TimeSlot time);

// Initialize the conflict graph
void initialize_graph() {
    conflict_graph.num_events = 0;
    for (int i = 0; i < MAX_EVENTS; i++) {
        conflict_graph.adjacency_list[i] = NULL;
        for (int j = 0; j < MAX_EVENTS; j++) {
            conflict_graph.conflicts[i][j] = false;
        }
    }
}

// Check if two time slots conflict
bool check_time_conflict(TimeSlot t1, TimeSlot t2) {
    int t1_start = t1.start_hour * 60 + t1.start_minute;
    int t1_end = t1.end_hour * 60 + t1.end_minute;
    int t2_start = t2.start_hour * 60 + t2.start_minute;
    int t2_end = t2.end_hour * 60 + t2.end_minute;
    
    return !(t1_end <= t2_start || t2_end <= t1_start);
}

// Add a new event
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
    
    new_event.color = -1;  // Not colored yet
    new_event.scheduled = false;
    new_event.priority = priority;
    
    events[num_events] = new_event;
    num_events++;
    
    printf("Event '%s' added successfully with ID: %d\n", name, new_event.id);
    
    // Rebuild conflict graph and reschedule
    build_conflict_graph();
    dynamic_reschedule();
}

// Remove an event
void remove_event(int event_id) {
    int index = -1;
    for (int i = 0; i < num_events; i++) {
        if (events[i].id == event_id) {
            index = i;
            break;
        }
    }
    
    if (index == -1) {
        printf("Event with ID %d not found.\n", event_id);
        return;
    }
    
    printf("Removing event '%s' (ID: %d)\n", events[index].name, event_id);
    
    // Shift remaining events
    for (int i = index; i < num_events - 1; i++) {
        events[i] = events[i + 1];
    }
    num_events--;
    
    // Rebuild conflict graph and reschedule
    build_conflict_graph();
    dynamic_reschedule();
}

// Build conflict graph based on time overlaps
void build_conflict_graph() {
    initialize_graph();
    conflict_graph.num_events = num_events;
    
    for (int i = 0; i < num_events; i++) {
        for (int j = i + 1; j < num_events; j++) {
            if (check_time_conflict(events[i].time, events[j].time)) {
                conflict_graph.conflicts[i][j] = true;
                conflict_graph.conflicts[j][i] = true;
                
                // Add to adjacency list
                GraphNode* node1 = (GraphNode*)malloc(sizeof(GraphNode));
                node1->event_id = j;
                node1->next = conflict_graph.adjacency_list[i];
                conflict_graph.adjacency_list[i] = node1;
                
                GraphNode* node2 = (GraphNode*)malloc(sizeof(GraphNode));
                node2->event_id = i;
                node2->next = conflict_graph.adjacency_list[j];
                conflict_graph.adjacency_list[j] = node2;
            }
        }
    }
}

// Print the conflict graph
void print_graph() {
    printf("\n=== CONFLICT GRAPH ===\n");
    for (int i = 0; i < num_events; i++) {
        printf("Event %d (%s): ", events[i].id, events[i].name);
        GraphNode* current = conflict_graph.adjacency_list[i];
        while (current != NULL) {
            printf("%d ", events[current->event_id].id);
            current = current->next;
        }
        printf("\n");
    }
    printf("====================\n\n");
}

// Welsh-Powell Graph Coloring Algorithm
void welsh_powell_coloring() {
    // Sort events by degree (number of conflicts) in descending order
    int degree[MAX_EVENTS];
    int event_order[MAX_EVENTS];
    
    for (int i = 0; i < num_events; i++) {
        degree[i] = 0;
        event_order[i] = i;
        
        // Count conflicts (degree)
        GraphNode* current = conflict_graph.adjacency_list[i];
        while (current != NULL) {
            degree[i]++;
            current = current->next;
        }
    }
    
    // Sort by degree (bubble sort for simplicity)
    for (int i = 0; i < num_events - 1; i++) {
        for (int j = 0; j < num_events - i - 1; j++) {
            if (degree[event_order[j]] < degree[event_order[j + 1]]) {
                int temp = event_order[j];
                event_order[j] = event_order[j + 1];
                event_order[j + 1] = temp;
            }
        }
    }
    
    // Initialize colors
    for (int i = 0; i < num_events; i++) {
        events[i].color = -1;
    }
    
    // Color each event
    for (int i = 0; i < num_events; i++) {
        int event_index = event_order[i];
        int color = 0;
        
        // Find the smallest available color
        bool color_used[MAX_COLORS] = {false};
        
        GraphNode* current = conflict_graph.adjacency_list[event_index];
        while (current != NULL) {
            int neighbor_id = events[current->event_id].id;
            for (int j = 0; j < num_events; j++) {
                if (events[j].id == neighbor_id && events[j].color != -1) {
                    color_used[events[j].color] = true;
                    break;
                }
            }
            current = current->next;
        }
        
        // Assign first available color
        while (color < MAX_COLORS && color_used[color]) {
            color++;
        }
        
        events[event_index].color = color;
    }
}

// Greedy Interval Scheduling Algorithm
void greedy_interval_scheduling() {
    // Sort events by priority (highest first) and then by start time
    for (int i = 0; i < num_events - 1; i++) {
        for (int j = 0; j < num_events - i - 1; j++) {
            bool should_swap = false;
            
            // First sort by priority (higher priority first)
            if (events[j].priority < events[j + 1].priority) {
                should_swap = true;
            }
            // If priorities are equal, sort by start time
            else if (events[j].priority == events[j + 1].priority) {
                int time1 = events[j].time.start_hour * 60 + events[j].time.start_minute;
                int time2 = events[j + 1].time.start_hour * 60 + events[j + 1].time.start_minute;
                if (time1 > time2) {
                    should_swap = true;
                }
            }
            
            if (should_swap) {
                Event temp = events[j];
                events[j] = events[j + 1];
                events[j + 1] = temp;
            }
        }
    }
    
    // Mark all events as unscheduled initially
    for (int i = 0; i < num_events; i++) {
        events[i].scheduled = false;
    }
    
    // Schedule events greedily
    for (int i = 0; i < num_events; i++) {
        bool can_schedule = true;
        
        // Check for conflicts with already scheduled events
        for (int j = 0; j < i; j++) {
            if (events[j].scheduled && check_time_conflict(events[i].time, events[j].time)) {
                can_schedule = false;
                break;
            }
        }
        
        if (can_schedule) {
            events[i].scheduled = true;
        }
    }
}

// Convert time to slot number (30-minute slots)
int get_time_slot(int hour, int minute) {
    return (hour * 60 + minute) / 30;
}

// Convert slot number back to time
TimeSlot get_time_from_slot(int slot) {
    TimeSlot time;
    int total_minutes = slot * 30;
    time.start_hour = total_minutes / 60;
    time.start_minute = total_minutes % 60;
    time.end_hour = (total_minutes + 30) / 60;
    time.end_minute = (total_minutes + 30) % 60;
    return time;
}

// Check if an event can be scheduled at a specific time
bool can_schedule_at_time(int event_id, TimeSlot time) {
    for (int i = 0; i < num_events; i++) {
        if (events[i].id != event_id && events[i].scheduled && 
            check_time_conflict(time, events[i].time)) {
            return false;
        }
    }
    return true;
}

// Dynamic rescheduling when events are added/removed
void dynamic_reschedule() {
    printf("\n=== DYNAMIC RESCHEDULING ===\n");
    
    // First try greedy scheduling
    greedy_interval_scheduling();
    
    // Check for unscheduled events
    int unscheduled_count = 0;
    for (int i = 0; i < num_events; i++) {
        if (!events[i].scheduled) {
            unscheduled_count++;
        }
    }
    
    if (unscheduled_count > 0) {
        printf("Warning: %d events could not be scheduled due to conflicts!\n", unscheduled_count);
        
        // Apply graph coloring for alternative scheduling
        welsh_powell_coloring();
        
        // Try to find alternative time slots for unscheduled events
        for (int i = 0; i < num_events; i++) {
            if (!events[i].scheduled) {
                // Try different time slots
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

// Print the current schedule
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

// Print all events
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

// Main menu function
void print_menu() {
    printf("\n=== DYNAMIC EVENT SCHEDULER ===\n");
    printf("1. Add Event\n");
    printf("2. Remove Event\n");
    printf("3. View Schedule\n");
    printf("4. View All Events\n");
    printf("5. View Conflict Graph\n");
    printf("6. Manual Reschedule\n");
    printf("7. Exit\n");
    printf("Enter your choice: ");
}

// Main function with interactive menu
int main() {
    printf("Welcome to Dynamic Event Scheduler!\n");
    printf("This program demonstrates:\n");
    printf("- Graph Coloring (Welsh-Powell Algorithm)\n");
    printf("- Greedy Interval Scheduling\n");
    printf("- Dynamic Conflict Resolution\n\n");
    
    initialize_graph();
    
    // Add some sample events
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
                printf("Thank you for using Dynamic Event Scheduler!\n");
                break;
            default:
                printf("Invalid choice. Please try again.\n");
        }
    } while (choice != 7);
    
    return 0;
}
