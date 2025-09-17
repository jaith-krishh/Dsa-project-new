# Dynamic Event Scheduler Using Graph Coloring

A comprehensive C program that demonstrates advanced Data Structures and Algorithms concepts including Graph Coloring, Greedy Algorithms, and Interval Scheduling.

## 🎯 Project Overview

This application schedules classes, events, or meetings without conflicts, even when information changes dynamically. It uses multiple DSA concepts to solve scheduling conflicts intelligently.

## 🔧 DSA Concepts Implemented

### 1. **Graph Coloring (Welsh-Powell Algorithm)**
- Creates a conflict graph where vertices represent events and edges represent time conflicts
- Uses the Welsh-Powell algorithm to color the graph with minimum colors
- Each color represents a different time slot, ensuring no conflicting events share the same color

### 2. **Greedy Interval Scheduling**
- Sorts events by priority and start time
- Uses greedy approach to schedule events without conflicts
- Higher priority events get preference over lower priority ones

### 3. **Dynamic Conflict Resolution**
- Automatically rebuilds conflict graph when events are added/removed
- Performs dynamic rescheduling to resolve conflicts
- Suggests alternative time slots for unscheduled events

## 🚀 Features

- **Add Events**: Add new events with name, time, duration, and priority
- **Remove Events**: Remove existing events and auto-reschedule remaining ones
- **Conflict Detection**: Automatically detects time conflicts between events
- **Smart Scheduling**: Uses multiple algorithms to find optimal schedules
- **Dynamic Updates**: Handles real-time changes to the schedule
- **Visualization**: Shows conflict graph and current schedule
- **Alternative Scheduling**: Finds alternative time slots for conflicted events

## 📊 Data Structures Used

1. **Event Structure**: Stores event details (ID, name, time, duration, priority)
2. **Conflict Graph**: Adjacency list representation for conflict detection
3. **Time Slots**: 30-minute time slots for granular scheduling
4. **Priority Queue**: For greedy scheduling based on priority

## 🎮 How to Use

### Compilation
```bash
gcc project.c -o scheduler
```

### Running the Program
```bash
./scheduler
```

### Menu Options
1. **Add Event**: Create new events with specific details
2. **Remove Event**: Delete events by ID
3. **View Schedule**: See the current optimized schedule
4. **View All Events**: Display all events with their details
5. **View Conflict Graph**: Visualize event conflicts
6. **Manual Reschedule**: Force rescheduling of all events
7. **Exit**: Close the program

## 🔍 Algorithm Details

### Graph Coloring Process
1. Build conflict graph by checking time overlaps
2. Sort events by degree (number of conflicts)
3. Apply Welsh-Powell coloring algorithm
4. Assign colors (time slots) to minimize conflicts

### Greedy Scheduling Process
1. Sort events by priority (highest first)
2. For events with same priority, sort by start time
3. Schedule events greedily, avoiding conflicts
4. Mark unscheduled events for alternative scheduling

### Dynamic Rescheduling
1. Detect changes in event list
2. Rebuild conflict graph
3. Apply greedy scheduling first
4. Use graph coloring for unscheduled events
5. Find alternative time slots if possible

## 📈 Time Complexity

- **Conflict Detection**: O(n²)
- **Graph Coloring**: O(n²)
- **Greedy Scheduling**: O(n log n)
- **Dynamic Rescheduling**: O(n²)

## 🎯 Sample Usage

The program comes with pre-loaded sample events:
- Math Class (9:00-10:00, Priority 3)
- Physics Lab (10:00-11:30, Priority 4)
- Lunch Break (12:00-12:30, Priority 2)
- Study Group (14:00-16:00, Priority 3)
- Team Meeting (16:00-16:45, Priority 5)

## 🧪 Testing Scenarios

1. **Add conflicting event**: Try adding an event that overlaps with existing ones
2. **Remove high-priority event**: See how the system reschedules
3. **Add multiple events**: Test the system's ability to handle many conflicts
4. **Priority-based scheduling**: Observe how priority affects scheduling decisions

## 💡 Key Learning Points

- **Graph Theory**: Practical application of graph coloring
- **Greedy Algorithms**: How greedy choices lead to optimal solutions
- **Interval Scheduling**: Classic CS problem with real-world applications
- **Dynamic Programming**: Handling changing requirements efficiently
- **Data Structure Design**: Choosing appropriate structures for the problem

## 🔮 Future Enhancements

- Web-based interface
- Calendar integration
- Machine learning for optimal scheduling
- Resource allocation (rooms, equipment)
- Multi-user support
- Conflict resolution suggestions

This project demonstrates the power of combining multiple DSA concepts to solve complex real-world problems efficiently!
