// Dynamic Event Scheduler - Frontend JavaScript
class EventScheduler {
    constructor() {
        this.events = [];
        this.nextId = 1;
        this.conflicts = [];
        this.currentTab = 'schedule';
        this.showUnscheduled = false;
        this.currentDate = new Date();
        this.selectedDate = null;
        this.editingEvent = null;
        
        this.initializeEventListeners();
        this.setDefaultDate();
        this.loadEventsFromStorage();
        this.updateDisplay();
    }

    initializeEventListeners() {
        // Form submission
        this.setupFormListener();

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Action buttons
        document.getElementById('rescheduleBtn').addEventListener('click', () => {
            this.rescheduleAll();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAll();
        });

        document.getElementById('toggleUnscheduled').addEventListener('click', () => {
            this.showUnscheduled = !this.showUnscheduled;
            this.updateDisplay();
        });

        // Modal events
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        // Filter events
        document.getElementById('priorityFilter').addEventListener('change', () => {
            this.updateDisplay();
        });

        document.getElementById('statusFilter').addEventListener('change', () => {
            this.updateDisplay();
        });

        // Calendar controls
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.updateCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.updateCalendar();
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            const today = new Date();
            this.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
            this.selectedDate = this.formatDate(today);
            this.updateCalendar();
            // Ensure the selected date events panel reflects today
            this.showSelectedDateEvents();
        });
    }

    setDefaultDate() {
        // Set default date to today and set minimum date
        const dateInput = document.getElementById('eventDate');
        if (dateInput) {
            const today = this.formatDate(new Date());
            dateInput.value = today;
            dateInput.min = today; // Prevent selecting past dates
        }
    }

    setupFormListener() {
        const form = document.getElementById('eventForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingEvent) {
                this.updateEvent();
            } else {
                this.addEvent();
            }
        });
    }

    resetForm() {
        document.getElementById('eventForm').reset();
        this.setDefaultDate();
        
        // Reset submit button
        const submitBtn = document.querySelector('#eventForm button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Event';
        
        // Clear editing state
        this.editingEvent = null;
    }

    saveEventsToStorage() {
        try {
            localStorage.setItem('eventScheduler_events', JSON.stringify(this.events));
            localStorage.setItem('eventScheduler_nextId', this.nextId.toString());
        } catch (error) {
            console.error('Error saving events to storage:', error);
        }
    }

    // Remove duplicate events that share the same (name, date, startTime)
    dedupeEvents() {
        const keyToEvent = new Map();
        for (const evt of this.events) {
            const key = `${(evt.name || '').trim().toLowerCase()}|${evt.date}|${evt.startTime}`;
            const existing = keyToEvent.get(key);
            if (!existing) {
                keyToEvent.set(key, evt);
                continue;
            }
            // Prefer the one marked scheduled; if both same, keep the one with the larger id (latest)
            const pick = (evt.scheduled && !existing.scheduled) ? evt
                : (!evt.scheduled && existing.scheduled) ? existing
                : (evt.id > existing.id ? evt : existing);
            keyToEvent.set(key, pick);
        }
        // Rebuild events array from map, preserving stable order by id
        const uniqueEvents = Array.from(keyToEvent.values()).sort((a, b) => a.id - b.id);
        if (uniqueEvents.length !== this.events.length) {
            this.events = uniqueEvents;
        }
    }

    loadEventsFromStorage() {
        try {
            const savedEvents = localStorage.getItem('eventScheduler_events');
            const savedNextId = localStorage.getItem('eventScheduler_nextId');
            
            if (savedEvents) {
                this.events = JSON.parse(savedEvents);
                // Filter out events from past dates
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                this.events = this.events.filter(event => {
                    const eventDate = new Date(event.date);
                    return eventDate >= today;
                });
                
                // Add missing fields to existing events
                this.events.forEach(event => {
                    if (event.color === undefined) event.color = -1;
                    if (event.degree === undefined) event.degree = 0;
                });
                
                // Clean up any duplicates that may have been saved earlier
                this.dedupeEvents();
            }
            
            if (savedNextId) {
                this.nextId = parseInt(savedNextId);
            }
        } catch (error) {
            console.error('Error loading events from storage:', error);
            this.events = [];
            this.nextId = 1;
        }
    }


    addEvent() {
        const form = document.getElementById('eventForm');
        const formData = new FormData(form);
        
        const eventData = {
            name: document.getElementById('eventName').value,
            startTime: document.getElementById('startTime').value,
            duration: parseInt(document.getElementById('duration').value),
            priority: parseInt(document.getElementById('priority').value),
            date: document.getElementById('eventDate').value
        };

        // Validate date (cannot be in the past)
        const selectedDate = new Date(eventData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            this.showNotification('Cannot add events to past dates!', 'error');
            return;
        }

        // Validate time for today's events
        if (selectedDate.getTime() === today.getTime()) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const [startHour, startMinute] = eventData.startTime.split(':').map(Number);
            const eventStartTime = startHour * 60 + startMinute;
            
            if (eventStartTime < currentTime) {
                this.showNotification('Cannot schedule events in the past for today!', 'error');
                return;
            }
        }

        this.addEventFromData(eventData);
        // Ensure no duplicates remain
        this.dedupeEvents();
        this.resetForm(); // Reset form and editing state
        this.saveEventsToStorage(); // Save to browser storage
        this.showNotification('Event added successfully!', 'success');
    }

    addEventFromData(eventData) {
        const event = {
            id: this.nextId++,
            name: eventData.name,
            startTime: eventData.startTime,
            duration: eventData.duration,
            priority: eventData.priority,
            date: eventData.date || this.formatDate(new Date()),
            scheduled: true,
            color: -1,  // Graph coloring result (-1 = uncolored)
            degree: 0   // Number of conflicts (for Welsh-Powell sorting)
        };

        // Calculate end time
        const [startHour, startMinute] = eventData.startTime.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMinute + eventData.duration;
        event.endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;

        this.events.push(event);
        this.detectConflicts();
        this.updateDisplay();
    }

    removeEvent(eventId) {
        this.events = this.events.filter(event => event.id !== eventId);
        this.detectConflicts();
        // Ensure duplicates are also cleaned up
        this.dedupeEvents();
        this.saveEventsToStorage(); // Save to browser storage
        this.updateDisplay();
        this.showNotification('Event removed successfully!', 'success');
    }

    detectConflicts() {
        this.conflicts = [];
        
        // Reset degrees
        this.events.forEach(event => event.degree = 0);
        
        for (let i = 0; i < this.events.length; i++) {
            for (let j = i + 1; j < this.events.length; j++) {
                // Only check conflicts for events on the same date
                if (this.events[i].date === this.events[j].date && this.eventsOverlap(this.events[i], this.events[j])) {
                    this.conflicts.push([this.events[i].id, this.events[j].id]);
                    this.events[i].scheduled = false;
                    this.events[j].scheduled = false;
                    // Count degrees for Welsh-Powell
                    this.events[i].degree++;
                    this.events[j].degree++;
                }
            }
        }

        // Apply greedy scheduling first
        this.applyGreedyScheduling();
        
        // Apply Welsh-Powell coloring for unscheduled events
        this.welshPowellColoring();
    }

    eventsOverlap(event1, event2) {
        const timeToMinutes = (time) => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const start1 = timeToMinutes(event1.startTime);
        const end1 = start1 + event1.duration;
        const start2 = timeToMinutes(event2.startTime);
        const end2 = start2 + event2.duration;

        return !(end1 <= start2 || end2 <= start1);
    }

    applyGreedyScheduling() {
        // Group events by date
        const eventsByDate = {};
        this.events.forEach(event => {
            if (!eventsByDate[event.date]) {
                eventsByDate[event.date] = [];
            }
            eventsByDate[event.date].push(event);
        });

        // Apply greedy scheduling for each date
        Object.keys(eventsByDate).forEach(date => {
            const dateEvents = eventsByDate[date];
            
            // Sort by priority (descending) then by start time
            dateEvents.sort((a, b) => {
                if (b.priority !== a.priority) {
                    return b.priority - a.priority;
                }
                return a.startTime.localeCompare(b.startTime);
            });

            // Mark all as unscheduled first
            dateEvents.forEach(event => event.scheduled = false);

            // Schedule events greedily for this date
            for (let i = 0; i < dateEvents.length; i++) {
                let canSchedule = true;
                
                for (let j = 0; j < i; j++) {
                    if (dateEvents[j].scheduled && this.eventsOverlap(dateEvents[i], dateEvents[j])) {
                        canSchedule = false;
                        break;
                    }
                }
                
                if (canSchedule) {
                    dateEvents[i].scheduled = true;
                }
            }
        });
    }

    welshPowellColoring() {
        // Initialize all colors to -1 (uncolored)
        this.events.forEach(event => event.color = -1);
        
        // Create a copy of events sorted by degree (descending)
        const sortedEvents = [...this.events].sort((a, b) => {
            if (b.degree !== a.degree) {
                return b.degree - a.degree; // Higher degree first
            }
            return a.id - b.id; // Stable sort by ID
        });
        
        console.log('Welsh-Powell Coloring - Events by degree:', sortedEvents.map(e => ({name: e.name, degree: e.degree})));
        
        // Color each event in sorted order
        sortedEvents.forEach(event => {
            const usedColors = new Set();
            
            // Check colors of conflicting events
            this.conflicts.forEach(([id1, id2]) => {
                let conflictingEvent = null;
                if (id1 === event.id) {
                    conflictingEvent = this.events.find(e => e.id === id2);
                } else if (id2 === event.id) {
                    conflictingEvent = this.events.find(e => e.id === id1);
                }
                
                if (conflictingEvent && conflictingEvent.color !== -1) {
                    usedColors.add(conflictingEvent.color);
                }
            });
            
            // Find the minimum available color
            let color = 0;
            while (usedColors.has(color)) {
                color++;
            }
            
            // Assign color to the original event
            const originalEvent = this.events.find(e => e.id === event.id);
            if (originalEvent) {
                originalEvent.color = color;
                console.log(`Assigned color ${color} to event "${originalEvent.name}" (degree: ${originalEvent.degree})`);
            }
        });
        
        // Log final coloring results
        console.log('Final coloring:', this.events.map(e => ({name: e.name, color: e.color, degree: e.degree})));
    }

    rescheduleAll() {
        this.detectConflicts();
        this.showNotification('Rescheduling completed!', 'info');
    }

    clearAll() {
        if (confirm('Are you sure you want to clear all events?')) {
        this.events = [];
        this.conflicts = [];
        this.nextId = 1;
        this.saveEventsToStorage(); // Save to browser storage
        this.updateDisplay();
        this.showNotification('All events cleared!', 'warning');
        }
    }


    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;
        this.updateDisplay();
    }

    updateDisplay() {
        this.updateStats();
        this.updateScheduleView();
        this.updateConflictGraph();
        this.updateEventsList();
        this.updateCalendar();
    }

    updateStats() {
        document.getElementById('totalEvents').textContent = this.events.length;
        document.getElementById('conflictCount').textContent = this.conflicts.length;
        
        const scheduledEvents = this.events.filter(event => event.scheduled);
        document.getElementById('unscheduledCount').textContent = this.events.length - scheduledEvents.length;
    }

    updateScheduleView() {
        const scheduleGrid = document.getElementById('scheduleGrid');
        scheduleGrid.innerHTML = '';

        let eventsToShow = this.events;
        
        // Filter by scheduled status if needed
        if (!this.showUnscheduled) {
            eventsToShow = eventsToShow.filter(event => event.scheduled);
        }

        if (eventsToShow.length === 0) {
            scheduleGrid.innerHTML = '<div class="text-center text-muted p-4">No events to display</div>';
            return;
        }

        eventsToShow.forEach(event => {
            const eventElement = this.createScheduleItem(event);
            scheduleGrid.appendChild(eventElement);
        });
    }

    createScheduleItem(event) {
        const div = document.createElement('div');
        div.className = `schedule-item priority-${event.priority} ${event.scheduled ? '' : 'unscheduled'}`;
        div.onclick = () => this.showEventModal(event);

        div.innerHTML = `
            <div class="event-header">
                <div class="event-name">${event.name}</div>
                <div class="event-time">${event.startTime} - ${event.endTime}</div>
            </div>
            <div class="event-details">
                <div class="event-detail">
                    <i class="fas fa-clock"></i>
                    <span>${event.duration} minutes</span>
                </div>
                <div class="event-detail">
                    <i class="fas fa-star"></i>
                    <span>Priority ${event.priority}</span>
                </div>
                <div class="event-detail">
                    <i class="fas fa-${event.scheduled ? 'check-circle' : 'exclamation-circle'}"></i>
                    <span>${event.scheduled ? 'Scheduled' : 'Unscheduled'}</span>
                </div>
                <div class="event-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${event.date}</span>
                </div>
            </div>
        `;

        return div;
    }

    updateConflictGraph() {
        const graphContainer = document.getElementById('conflictGraph');
        
        if (this.events.length === 0) {
            graphContainer.innerHTML = '<div class="text-center text-muted">No events to display in conflict graph</div>';
            return;
        }

        // Create SVG for graph visualization
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '450');
        svg.setAttribute('viewBox', '0 0 800 450');
        
        // Add legend
        const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        legendGroup.setAttribute('transform', 'translate(20, 410)');
        
        // Legend text
        const legendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        legendText.setAttribute('x', 0);
        legendText.setAttribute('y', 0);
        legendText.setAttribute('font-size', '12');
        legendText.setAttribute('fill', '#4a5568');
        legendText.textContent = 'Colors: Graph Coloring (conflicted events) | Priority-based (non-conflicted events)';
        legendGroup.appendChild(legendText);
        svg.appendChild(legendGroup);

        // Calculate positions for nodes in a circle
        const centerX = 400;
        const centerY = 200;
        const radius = Math.min(150, 300 / this.events.length);
        
        this.events.forEach((event, index) => {
            const angle = (2 * Math.PI * index) / this.events.length;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            // Create node
            const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            node.setAttribute('cx', x);
            node.setAttribute('cy', y);
            node.setAttribute('r', 25);
            node.setAttribute('fill', this.getColorFromGraphColoring(event));
            
            // Different border for graph-colored vs priority-colored events
            if (event.degree > 0 && event.color !== -1) {
                node.setAttribute('stroke', '#2d3748'); // Dark border for graph-colored
                node.setAttribute('stroke-width', '4');
                node.setAttribute('stroke-dasharray', '5,3'); // Dashed border
            } else {
                node.setAttribute('stroke', 'white'); // White border for priority-colored
                node.setAttribute('stroke-width', '3');
            }
            
            node.setAttribute('class', 'graph-node');
            node.onclick = () => this.showEventModal(event);

            // Add event name
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y + 5);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'white');
            text.setAttribute('font-size', '12');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('class', 'graph-label');
            text.textContent = event.name.substring(0, 3).toUpperCase();
            text.onclick = () => this.showEventModal(event);

            svg.appendChild(node);
            svg.appendChild(text);

            // Draw conflict edges
            this.conflicts.forEach(([id1, id2]) => {
                if (id1 === event.id || id2 === event.id) {
                    const otherEvent = this.events.find(e => e.id === (id1 === event.id ? id2 : id1));
                    if (otherEvent) {
                        const otherIndex = this.events.findIndex(e => e.id === otherEvent.id);
                        const otherAngle = (2 * Math.PI * otherIndex) / this.events.length;
                        const otherX = centerX + radius * Math.cos(otherAngle);
                        const otherY = centerY + radius * Math.sin(otherAngle);

                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('x1', x);
                        line.setAttribute('y1', y);
                        line.setAttribute('x2', otherX);
                        line.setAttribute('y2', otherY);
                        line.setAttribute('stroke', '#e53e3e');
                        line.setAttribute('stroke-width', '2');
                        line.setAttribute('opacity', '0.7');

                        svg.insertBefore(line, svg.firstChild);
                    }
                }
            });
        });

        graphContainer.innerHTML = '';
        graphContainer.appendChild(svg);
    }

    updateEventsList() {
        const eventsList = document.getElementById('eventsList');
        eventsList.innerHTML = '';

        const priorityFilter = document.getElementById('priorityFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        let filteredEvents = this.events;

        if (priorityFilter !== 'all') {
            filteredEvents = filteredEvents.filter(event => event.priority.toString() === priorityFilter);
        }

        if (statusFilter !== 'all') {
            filteredEvents = filteredEvents.filter(event => 
                statusFilter === 'scheduled' ? event.scheduled : !event.scheduled
            );
        }

        if (filteredEvents.length === 0) {
            eventsList.innerHTML = '<div class="text-center text-muted p-4">No events match the current filters</div>';
            return;
        }

        filteredEvents.forEach(event => {
            const eventElement = this.createEventListItem(event);
            eventsList.appendChild(eventElement);
        });
    }

    createEventListItem(event) {
        const div = document.createElement('div');
        div.className = `event-list-item ${event.scheduled ? '' : 'unscheduled'}`;
        div.onclick = () => this.showEventModal(event);

        div.innerHTML = `
            <div class="event-list-header">
                <div class="event-list-name">${event.name}</div>
                <div class="event-list-status ${event.scheduled ? 'scheduled' : 'unscheduled'}">
                    ${event.scheduled ? 'Scheduled' : 'Unscheduled'}
                </div>
            </div>
            <div class="event-list-details">
                <div><i class="fas fa-clock"></i> ${event.startTime} - ${event.endTime}</div>
                <div><i class="fas fa-hourglass-half"></i> ${event.duration} min</div>
                <div><i class="fas fa-star"></i> Priority ${event.priority}</div>
                <div><i class="fas fa-calendar"></i> ${event.date}</div>
            </div>
        `;

        return div;
    }

    updateCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        const currentMonth = document.getElementById('currentMonth');
        
        // Update month display
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        currentMonth.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        
        // Clear calendar
        calendarGrid.innerHTML = '';
        
        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-day-header';
            header.textContent = day;
            calendarGrid.appendChild(header);
        });
        
        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyCell);
        }
        
        // Add days of the month
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            const currentDayDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dateString = this.formatDate(currentDayDate);
            const dayEvents = this.events.filter(event => event.date === dateString);
            
            // Check if this is a past date
            const isPastDate = currentDayDate < today;
            
            if (isPastDate) {
                dayElement.classList.add('past-date');
                dayElement.title = 'Past date - cannot add events';
            } else {
                // Only allow clicking on present and future dates
                dayElement.onclick = () => this.selectDate(dateString);
            }
            
            if (dayEvents.length > 0) {
                dayElement.classList.add('has-events');
                dayElement.title = `${dayEvents.length} event(s) on this day`;
            }
            
            // Highlight today
            if (this.currentDate.getMonth() === today.getMonth() && 
                this.currentDate.getFullYear() === today.getFullYear() && 
                day === today.getDate()) {
                dayElement.classList.add('today');
            }
            
            // Highlight selected date
            if (this.selectedDate && this.selectedDate === dateString) {
                dayElement.classList.add('selected');
            }
            
            calendarGrid.appendChild(dayElement);
        }
        
        // Update selected date events if a date is selected
        if (this.selectedDate) {
            this.showSelectedDateEvents();
        }
    }

    selectDate(dateString) {
        this.selectedDate = dateString;
        this.updateCalendar(); // Refresh calendar to show selection
        this.showSelectedDateEvents();
    }

    showSelectedDateEvents() {
        const selectedDateEvents = document.getElementById('selectedDateEvents');
        const dayEvents = this.events.filter(event => event.date === this.selectedDate);
        
        if (dayEvents.length === 0) {
            selectedDateEvents.innerHTML = `
                <div class="no-events">
                    <i class="fas fa-calendar-times"></i>
                    <p>No events scheduled for ${this.formatDateDisplay(this.selectedDate)}</p>
                </div>
            `;
            return;
        }
        
        selectedDateEvents.innerHTML = `
            <div class="selected-date-header">
                <h3><i class="fas fa-calendar-day"></i> Events for ${this.formatDateDisplay(this.selectedDate)}</h3>
                <span class="event-count">${dayEvents.length} event(s)</span>
            </div>
            <div class="selected-date-events-list">
                ${dayEvents.map(event => `
                    <div class="selected-date-event ${event.scheduled ? '' : 'unscheduled'}" onclick="scheduler.showEventModal(scheduler.events.find(e => e.id === ${event.id}))">
                        <div class="event-time">${event.startTime} - ${event.endTime}</div>
                        <div class="event-name">${event.name}</div>
                        <div class="event-priority">Priority ${event.priority}</div>
                        <div class="event-status">${event.scheduled ? 'Scheduled' : 'Unscheduled'}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    showEventModal(event) {
        const modal = document.getElementById('eventModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = event.name;
        modalBody.innerHTML = `
            <div class="event-details">
                <div class="event-detail">
                    <i class="fas fa-clock"></i>
                    <strong>Time:</strong> ${event.startTime} - ${event.endTime}
                </div>
                <div class="event-detail">
                    <i class="fas fa-hourglass-half"></i>
                    <strong>Duration:</strong> ${event.duration} minutes
                </div>
                <div class="event-detail">
                    <i class="fas fa-star"></i>
                    <strong>Priority:</strong> ${event.priority}
                </div>
                <div class="event-detail">
                    <i class="fas fa-${event.scheduled ? 'check-circle' : 'exclamation-circle'}"></i>
                    <strong>Status:</strong> ${event.scheduled ? 'Scheduled' : 'Unscheduled'}
                </div>
                <div class="event-detail">
                    <i class="fas fa-calendar"></i>
                    <strong>Date:</strong> ${this.formatDateDisplay(event.date)}
                </div>
                <div class="event-detail">
                    <i class="fas fa-palette"></i>
                    <strong>Graph Color:</strong> ${event.color !== -1 ? `Color ${event.color}` : 'Not assigned'}
                </div>
                <div class="event-detail">
                    <i class="fas fa-project-diagram"></i>
                    <strong>Conflicts:</strong> ${event.degree} event(s)
                </div>
            </div>
        `;

        document.getElementById('deleteEvent').onclick = () => {
            this.removeEvent(event.id);
            this.closeModal();
        };

        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('eventModal').classList.remove('active');
        this.editingEvent = null;
    }

    // edit/update features removed as requested

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        notifications.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDateDisplay(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    getColorFromPriority(priority) {
        const colors = {
            1: '#805ad5',
            2: '#3182ce',
            3: '#38a169',
            4: '#ed8936',
            5: '#e53e3e'
        };
        return colors[priority] || '#667eea';
    }

    getColorFromGraphColoring(event) {
        // If event has conflicts, use graph coloring colors
        if (event.degree > 0 && event.color !== -1) {
            const graphColors = [
                '#667eea', // Color 0 - Blue
                '#f093fb', // Color 1 - Pink
                '#4facfe', // Color 2 - Light Blue
                '#43e97b', // Color 3 - Green
                '#fa709a', // Color 4 - Rose
                '#fee140', // Color 5 - Yellow
                '#a8edea', // Color 6 - Cyan
                '#d299c2', // Color 7 - Purple
                '#89f7fe', // Color 8 - Sky Blue
                '#66a6ff'  // Color 9 - Periwinkle
            ];
            return graphColors[event.color % graphColors.length];
        }
        
        // For non-conflicted events, use priority-based colors
        return this.getColorFromPriority(event.priority);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scheduler = new EventScheduler();
});
