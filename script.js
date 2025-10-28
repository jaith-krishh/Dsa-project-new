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
        this.autoRescheduleEnabled = false;
        
        this.initializeEventListeners();
        this.setDefaultDate();
        this.loadEventsFromStorage();
        // updateDisplay() is now called from loadEventsFromStorage() after conflicts are detected
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

        document.getElementById('autoRescheduleBtn').addEventListener('click', () => {
            this.toggleAutomaticRescheduling();
            const btn = document.getElementById('autoRescheduleBtn');
            btn.innerHTML = this.autoRescheduleEnabled ? 
                '<i class="fas fa-magic"></i> Auto-Reschedule: ON' : 
                '<i class="fas fa-magic"></i> Auto-Reschedule: OFF';
            btn.classList.toggle('btn-primary', this.autoRescheduleEnabled);
            btn.classList.toggle('btn-secondary', !this.autoRescheduleEnabled);
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
            // Also save conflicts for complete state restoration
            localStorage.setItem('eventScheduler_conflicts', JSON.stringify(this.conflicts));
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
                
                // ✅ FIX: Rebuild conflicts and apply algorithms after loading
                if (this.events.length > 0) {
                    console.log('🔄 Reloaded events:', this.events.map(e => ({name: e.name, time: e.startTime, date: e.date})));
                    this.detectConflicts();
                    console.log('🔗 Conflicts after reload:', this.conflicts.length, 'conflicts found');
                    console.log('📊 Conflict details:', this.conflicts);
                } else {
                    console.log('📭 No events loaded from storage');
                }
            }
            
            if (savedNextId) {
                this.nextId = parseInt(savedNextId);
            }
            
            // Update display after everything is loaded and conflicts are detected
            // Use setTimeout to ensure DOM is ready and conflicts are properly processed
            setTimeout(() => {
                this.updateDisplay();
            }, 0);
        } catch (error) {
            console.error('Error loading events from storage:', error);
            this.events = [];
            this.nextId = 1;
            setTimeout(() => {
                this.updateDisplay(); // Still need to update display even if loading fails
            }, 0);
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
        
        // Show prioritization info if there are conflicts
        const unscheduledCount = this.events.filter(e => !e.scheduled).length;
        if (unscheduledCount > 0) {
            console.log(`⚡ Prioritization: Priority level → Input order (first added first) → Graph coloring`);
        }
        
        // Perform automatic rescheduling if enabled
        if (this.autoRescheduleEnabled) {
            this.performAutomaticRescheduling();
        }
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
            
            // Sort by priority (descending) then by input order (first added first)
            dateEvents.sort((a, b) => {
                if (b.priority !== a.priority) {
                    return b.priority - a.priority;  // Higher priority first
                }
                return a.id - b.id;  // Same priority: first added first (input order)
            });

            console.log(`📅 Greedy scheduling for ${date}:`, dateEvents.map((e, index) => ({
                order: index + 1,
                name: e.name, 
                priority: e.priority, 
                id: `#${e.id}`,
                time: e.startTime,
                reason: index === 0 ? 'Highest priority' : 
                       dateEvents[index-1].priority === e.priority ? 'Same priority, added first' : 
                       'Lower priority'
            })));

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

    // Generate available time slots (30-minute intervals) for full 24-hour period
    generateTimeSlots(date) {
        const slots = [];
        // Generate slots from 00:00 (midnight) to 23:30 (30-minute intervals)
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                slots.push({
                    start: startTime,
                    hour: hour,
                    minute: minute,
                    totalMinutes: hour * 60 + minute
                });
            }
        }
        return slots;
    }

    // Check if an event can be scheduled at a specific time slot
    canScheduleAtTime(event, timeSlot, duration) {
        const tempEvent = {
            ...event,
            startTime: timeSlot.start,
            duration: duration,
            date: event.date
        };

        // Calculate end time for temp event
        const totalMinutes = timeSlot.totalMinutes + duration;
        tempEvent.endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;

        // Check against all scheduled events on the same date
        return !this.events.some(existingEvent => 
            existingEvent.id !== event.id && 
            existingEvent.scheduled && 
            existingEvent.date === event.date &&
            this.eventsOverlap(tempEvent, existingEvent)
        );
    }

    // Find available time slots for an unscheduled event
    findAvailableTimeSlots(event) {
        const allSlots = this.generateTimeSlots(event.date);
        const availableSlots = [];

        allSlots.forEach(slot => {
            // Check if event fits in this slot (considering duration)
            const endTotalMinutes = slot.totalMinutes + event.duration;
            if (endTotalMinutes <= 24 * 60) { // Don't go past midnight (24:00)
                if (this.canScheduleAtTime(event, slot, event.duration)) {
                    // Handle end time that might go into next day
                    let endHour = Math.floor(endTotalMinutes / 60);
                    let endMinute = endTotalMinutes % 60;
                    
                    // If end time is 24:00, convert to 00:00 of next day
                    if (endHour >= 24) {
                        endHour = endHour % 24;
                    }
                    
                    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
                    availableSlots.push({
                        ...slot,
                        end: endTime,
                        duration: event.duration
                    });
                }
            }
        });

        return availableSlots;
    }

    // Calculate preference score for time slots (closer to original time = higher score)
    calculateTimeSlotPreference(originalTime, slotTime) {
        const originalMinutes = this.timeToMinutes(originalTime);
        const slotMinutes = slotTime.totalMinutes;
        const timeDifference = Math.abs(originalMinutes - slotMinutes);
        
        // Prefer slots closer to original time (lower difference = higher score)
        const maxDifference = 17 * 60; // Max 17 hours difference
        return Math.max(0, maxDifference - timeDifference);
    }

    // Convert time string to minutes
    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Get sorted available time slots with intelligent proximity-based preference
    getSortedAvailableSlots(event) {
        const originalMinutes = this.timeToMinutes(event.startTime);
        const originalEndMinutes = originalMinutes + event.duration;
        const availableSlots = this.findAvailableTimeSlots(event);
        
        // Add preference scores and categorize by proximity
        const slotsWithPreference = availableSlots.map(slot => {
            const timeDifference = Math.abs(originalMinutes - slot.totalMinutes);
            
            // Special handling: check if this slot starts right after the original event ends
            const isImmediatelyAfter = slot.totalMinutes === originalEndMinutes;
            
            // Categorize slots by proximity (in minutes)
            let proximityCategory;
            if (isImmediatelyAfter) proximityCategory = 0;        // Immediately after (best)
            else if (timeDifference <= 30) proximityCategory = 1; // ±30 min
            else if (timeDifference <= 60) proximityCategory = 2; // ±1 hour
            else if (timeDifference <= 120) proximityCategory = 3; // ±2 hours
            else if (timeDifference <= 240) proximityCategory = 4; // ±4 hours
            else proximityCategory = 5; // >4 hours
            
            return {
                ...slot,
                timeDifference,
                proximityCategory,
                preferenceScore: this.calculateTimeSlotPreference(event.startTime, slot),
                isBeforeOriginal: slot.totalMinutes < originalMinutes,
                isImmediatelyAfter
            };
        });

        // Sort by proximity category first, then by time difference
        slotsWithPreference.sort((a, b) => {
            // Primary sort: proximity category (closer = better)
            if (a.proximityCategory !== b.proximityCategory) {
                return a.proximityCategory - b.proximityCategory;
            }
            
            // Secondary sort: actual time difference (smaller = better)
            if (a.timeDifference !== b.timeDifference) {
                return a.timeDifference - b.timeDifference;
            }
            
            // Tertiary sort: prefer slots after original time slightly
            return a.isBeforeOriginal - b.isBeforeOriginal;
        });

        return slotsWithPreference;
    }

    // Get slots grouped by proximity for better user choice presentation
    getSlotsByProximity(event) {
        const sortedSlots = this.getSortedAvailableSlots(event);
        
        const proximityGroups = {
            perfect: [],   // Immediately after event ends
            immediate: [], // ±30 min
            nearby: [],    // ±1 hour
            close: [],     // ±2 hours
            moderate: [],  // ±4 hours
            distant: []    // >4 hours
        };

        sortedSlots.forEach(slot => {
            switch (slot.proximityCategory) {
                case 0: proximityGroups.perfect.push(slot); break;
                case 1: proximityGroups.immediate.push(slot); break;
                case 2: proximityGroups.nearby.push(slot); break;
                case 3: proximityGroups.close.push(slot); break;
                case 4: proximityGroups.moderate.push(slot); break;
                case 5: proximityGroups.distant.push(slot); break;
            }
        });

        return proximityGroups;
    }

    // Generate HTML for proximity-grouped time slots
    generateProximityGroupsHTML(event, proximityGroups) {
        const groupConfigs = [
            { key: 'perfect', title: 'Perfect Match', subtitle: 'Right after event ends', icon: 'fas fa-star', color: 'perfect' },
            { key: 'immediate', title: 'Immediate Options', subtitle: '±30 minutes', icon: 'fas fa-bullseye', color: 'success' },
            { key: 'nearby', title: 'Nearby Options', subtitle: '±1 hour', icon: 'fas fa-crosshairs', color: 'info' },
            { key: 'close', title: 'Close Options', subtitle: '±2 hours', icon: 'fas fa-dot-circle', color: 'warning' },
            { key: 'moderate', title: 'Moderate Distance', subtitle: '±4 hours', icon: 'fas fa-circle', color: 'secondary' },
            { key: 'distant', title: 'Distant Options', subtitle: '>4 hours', icon: 'fas fa-circle-o', color: 'muted' }
        ];

        let html = '';
        
        groupConfigs.forEach(config => {
            const slots = proximityGroups[config.key];
            if (slots.length > 0) {
                html += `
                    <div class="proximity-group ${config.color}">
                        <div class="group-header">
                            <i class="${config.icon}"></i>
                            <span class="group-title">${config.title}</span>
                            <span class="group-subtitle">${config.subtitle}</span>
                            <span class="group-count">${slots.length} option${slots.length > 1 ? 's' : ''}</span>
                        </div>
                        <div class="group-slots">
                            ${slots.slice(0, 3).map((slot, index) => `
                                <div class="time-slot-option compact ${(index === 0 && config.key === 'perfect') || (index === 0 && config.key === 'immediate' && proximityGroups.perfect.length === 0) ? 'best-option' : ''}" 
                                     onclick="scheduler.rescheduleEvent(${event.id}, '${slot.start}', '${slot.end}')">
                                    <div class="slot-time">
                                        <i class="fas fa-clock"></i>
                                        ${slot.start} - ${slot.end}
                                    </div>
                                    <div class="slot-info">
                                        ${slot.isImmediatelyAfter ? 
                                            '<span class="perfect-badge"><i class="fas fa-star"></i> Perfect Match</span>' : 
                                            (index === 0 && config.key === 'immediate' && proximityGroups.perfect.length === 0) ?
                                            '<span class="best-badge"><i class="fas fa-star"></i> Best Match</span>' : 
                                            `<span class="time-diff">${this.formatTimeDifference(slot.timeDifference)} ${slot.isBeforeOriginal ? 'before' : 'after'}</span>`
                                        }
                                    </div>
                                </div>
                            `).join('')}
                            ${slots.length > 3 ? `
                                <div class="more-slots-indicator">
                                    <i class="fas fa-ellipsis-h"></i>
                                    <span>+${slots.length - 3} more in this range</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
        });

        return html || '<p class="no-options">No suitable time slots found.</p>';
    }

    // Format time difference in a user-friendly way
    formatTimeDifference(minutes) {
        if (minutes < 60) {
            return `${minutes}min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
    }

    // Reschedule an event to a new time slot
    rescheduleEvent(eventId, newStartTime, newEndTime) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        const oldTime = `${event.startTime} - ${event.endTime}`;
        
        // Update event times
        event.startTime = newStartTime;
        event.endTime = newEndTime;
        event.scheduled = true;

        // Recalculate conflicts and update display
        this.detectConflicts();
        this.saveEventsToStorage();
        this.updateDisplay();
        
        // Close modal and show success notification
        this.closeModal();
        this.showNotification(
            `✅ Rescheduled "${event.name}" from ${oldTime} to ${newStartTime} - ${newEndTime}`, 
            'success'
        );
    }

    // Show all available time slots in a separate modal with proximity grouping
    showAllTimeSlots(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        const proximityGroups = this.getSlotsByProximity(event);
        const totalSlots = Object.values(proximityGroups).flat().length;
        
        // Create a new modal for all time slots
        const allSlotsModal = document.createElement('div');
        allSlotsModal.className = 'modal active';
        allSlotsModal.id = 'allSlotsModal';
        
        allSlotsModal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-clock"></i> All Available Time Slots for "${event.name}"</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="slots-info">
                        <p><strong>Original Time:</strong> ${event.startTime} - ${event.endTime}</p>
                        <p><strong>Duration:</strong> ${event.duration} minutes</p>
                        <p><strong>Available Slots:</strong> ${totalSlots} options found, organized by proximity</p>
                    </div>
                    
                    <div class="all-slots-organized">
                        ${this.generateAllSlotsHTML(event, proximityGroups)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(allSlotsModal);
    }

    // Generate a summary of available slots by proximity
    generateSlotsSummary(proximityGroups) {
        const summaryItems = [
            { key: 'perfect', label: 'Perfect', icon: 'fas fa-star', color: '#9f7aea' },
            { key: 'immediate', label: '±30min', icon: 'fas fa-bullseye', color: '#38a169' },
            { key: 'nearby', label: '±1h', icon: 'fas fa-crosshairs', color: '#3182ce' },
            { key: 'close', label: '±2h', icon: 'fas fa-dot-circle', color: '#ed8936' },
            { key: 'moderate', label: '±4h', icon: 'fas fa-circle', color: '#718096' },
            { key: 'distant', label: '>4h', icon: 'fas fa-circle-o', color: '#cbd5e0' }
        ];

        return `
            <div class="summary-badges">
                ${summaryItems.map(item => {
                    const count = proximityGroups[item.key].length;
                    return count > 0 ? `
                        <div class="summary-badge" style="border-color: ${item.color}; color: ${item.color};">
                            <i class="${item.icon}"></i>
                            <span class="badge-count">${count}</span>
                            <span class="badge-label">${item.label}</span>
                        </div>
                    ` : '';
                }).join('')}
            </div>
        `;
    }

    // Generate HTML for all slots organized by proximity
    generateAllSlotsHTML(event, proximityGroups) {
        const groupConfigs = [
            { key: 'perfect', title: 'Perfect Match', subtitle: 'Right after event ends', icon: 'fas fa-star', color: 'perfect' },
            { key: 'immediate', title: 'Immediate Options', subtitle: '±30 minutes', icon: 'fas fa-bullseye', color: 'success' },
            { key: 'nearby', title: 'Nearby Options', subtitle: '±1 hour', icon: 'fas fa-crosshairs', color: 'info' },
            { key: 'close', title: 'Close Options', subtitle: '±2 hours', icon: 'fas fa-dot-circle', color: 'warning' },
            { key: 'moderate', title: 'Moderate Distance', subtitle: '±4 hours', icon: 'fas fa-circle', color: 'secondary' },
            { key: 'distant', title: 'Distant Options', subtitle: '>4 hours', icon: 'fas fa-circle-o', color: 'muted' }
        ];

        let html = '';
        
        groupConfigs.forEach(config => {
            const slots = proximityGroups[config.key];
            if (slots.length > 0) {
                html += `
                    <div class="all-slots-group">
                        <div class="group-header-full">
                            <i class="${config.icon}"></i>
                            <span class="group-title">${config.title}</span>
                            <span class="group-subtitle">${config.subtitle}</span>
                            <span class="group-count">${slots.length} option${slots.length > 1 ? 's' : ''}</span>
                        </div>
                        <div class="slots-grid">
                            ${slots.map((slot, index) => `
                                <div class="time-slot-card ${config.key === 'perfect' || (index === 0 && config.key === 'immediate' && proximityGroups.perfect.length === 0) ? 'best-option' : ''}" 
                                     onclick="scheduler.rescheduleEvent(${event.id}, '${slot.start}', '${slot.end}'); this.closest('.modal').remove();">
                                    <div class="slot-header">
                                        <span class="slot-time">${slot.start} - ${slot.end}</span>
                                        ${slot.isImmediatelyAfter || (index === 0 && config.key === 'immediate' && proximityGroups.perfect.length === 0) ? '<span class="best-star"><i class="fas fa-star"></i></span>' : ''}
                                    </div>
                                    <div class="slot-details">
                                        <div class="time-difference">
                                            <i class="fas fa-${slot.isImmediatelyAfter ? 'play' : slot.isBeforeOriginal ? 'arrow-left' : 'arrow-right'}"></i>
                                            ${slot.isImmediatelyAfter ? 'Immediately after' : `${this.formatTimeDifference(slot.timeDifference)} ${slot.isBeforeOriginal ? 'before' : 'after'}`}
                                        </div>
                                        <div class="proximity-indicator">
                                            <i class="fas fa-location-arrow"></i>
                                            ${config.subtitle}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        });

        return html || '<p class="no-options">No suitable time slots found.</p>';
    }

    // Perform automatic rescheduling for unscheduled events (optional feature)
    performAutomaticRescheduling() {
        const unscheduledEvents = this.events.filter(event => !event.scheduled);
        let rescheduledCount = 0;
        const rescheduledDetails = [];

        unscheduledEvents.forEach(event => {
            const proximityGroups = this.getSlotsByProximity(event);
            
            // Try perfect slots first (immediately after), then immediate (±30 min), then nearby (±1 hour)
            const prioritySlots = [
                ...proximityGroups.perfect,
                ...proximityGroups.immediate,
                ...proximityGroups.nearby
            ];
            
            if (prioritySlots.length > 0) {
                const bestSlot = prioritySlots[0];
                const oldTime = `${event.startTime}-${event.endTime}`;
                
                event.startTime = bestSlot.start;
                event.endTime = bestSlot.end;
                event.scheduled = true;
                rescheduledCount++;
                
                rescheduledDetails.push({
                    name: event.name,
                    oldTime,
                    newTime: `${bestSlot.start}-${bestSlot.end}`,
                    timeDiff: this.formatTimeDifference(bestSlot.timeDifference),
                    direction: bestSlot.isBeforeOriginal ? 'before' : 'after'
                });
                
                console.log(`Auto-rescheduled "${event.name}" from ${oldTime} to ${bestSlot.start}-${bestSlot.end} (${this.formatTimeDifference(bestSlot.timeDifference)} ${bestSlot.isBeforeOriginal ? 'before' : 'after'})`);
            }
        });

        if (rescheduledCount > 0) {
            const summary = rescheduledDetails.map(detail => 
                `${detail.name}: ${detail.timeDiff} ${detail.direction}`
            ).join(', ');
            
            this.showNotification(
                `🤖 Auto-rescheduled ${rescheduledCount} event(s): ${summary}`, 
                'success'
            );
        }
    }

    // Enable/disable automatic rescheduling
    toggleAutomaticRescheduling() {
        this.autoRescheduleEnabled = !this.autoRescheduleEnabled;
        
        if (this.autoRescheduleEnabled) {
            this.detectConflicts(); // Re-run with auto-rescheduling
            this.showNotification('🤖 Automatic rescheduling enabled', 'info');
        } else {
            this.showNotification('🔧 Automatic rescheduling disabled - manual control only', 'info');
        }
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
        const unscheduledCount = this.events.length - scheduledEvents.length;
        document.getElementById('unscheduledCount').textContent = unscheduledCount;
        
        // Update unscheduled count color based on availability of solutions
        const unscheduledElement = document.getElementById('unscheduledCount');
        if (unscheduledCount > 0) {
            const unscheduledEvents = this.events.filter(event => !event.scheduled);
            const hasAvailableSlots = unscheduledEvents.some(event => 
                this.getSortedAvailableSlots(event).length > 0
            );
            
            unscheduledElement.style.color = hasAvailableSlots ? '#ed8936' : '#e53e3e';
            unscheduledElement.title = hasAvailableSlots ? 
                'Some unscheduled events have available time slots' : 
                'No available time slots found for unscheduled events';
        } else {
            unscheduledElement.style.color = '#38a169';
            unscheduledElement.title = 'All events successfully scheduled';
        }
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

        let quickRescheduleButton = '';
        if (!event.scheduled) {
            const proximityGroups = this.getSlotsByProximity(event);
            const bestSlots = [
                ...proximityGroups.perfect,
                ...proximityGroups.immediate,
                ...proximityGroups.nearby,
                ...proximityGroups.close
            ];
            
            if (bestSlots.length > 0) {
                const bestSlot = bestSlots[0];
                const timeDiff = this.formatTimeDifference(bestSlot.timeDifference);
                const direction = bestSlot.isBeforeOriginal ? 'before' : 'after';
                
                quickRescheduleButton = `
                    <div class="quick-reschedule" onclick="event.stopPropagation(); scheduler.rescheduleEvent(${event.id}, '${bestSlot.start}', '${bestSlot.end}')">
                        <i class="fas fa-magic"></i>
                        <span>Quick Fix: ${bestSlot.start}-${bestSlot.end}</span>
                        <small>(${timeDiff} ${direction})</small>
                    </div>
                `;
            } else {
                // Show that options exist but are distant
                const allSlots = this.getSortedAvailableSlots(event);
                if (allSlots.length > 0) {
                    quickRescheduleButton = `
                        <div class="quick-reschedule distant" onclick="event.stopPropagation(); scheduler.showEventModal(scheduler.events.find(e => e.id === ${event.id}))">
                            <i class="fas fa-search"></i>
                            <span>View ${allSlots.length} Available Slots</span>
                        </div>
                    `;
                }
            }
        }

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
            ${quickRescheduleButton}
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
        
        let modalContent = `
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

        // Add rescheduling options for unscheduled events
        if (!event.scheduled) {
            const proximityGroups = this.getSlotsByProximity(event);
            const totalSlots = Object.values(proximityGroups).flat().length;
            
            modalContent += `
                <div class="rescheduling-section">
                    <h4><i class="fas fa-magic"></i> Smart Rescheduling Options</h4>
                    <p class="reschedule-info">This event conflicts with others. Available slots organized by proximity to original time (${event.startTime}):</p>
                    
                    <div class="slots-summary">
                        ${this.generateSlotsSummary(proximityGroups)}
                    </div>
                    
                    ${totalSlots > 0 ? this.generateProximityGroupsHTML(event, proximityGroups) : `
                        <div class="no-slots-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>No available time slots found for this date. Consider:</p>
                            <ul>
                                <li>Changing the event date</li>
                                <li>Reducing the event duration</li>
                                <li>Removing conflicting events</li>
                            </ul>
                        </div>
                    `}
                    
                    ${totalSlots > 0 ? `
                        <div class="reschedule-actions">
                            <button class="btn btn-secondary btn-sm" onclick="scheduler.showAllTimeSlots(${event.id})">
                                <i class="fas fa-list"></i> View All ${totalSlots} Options
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        modalBody.innerHTML = modalContent;

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
