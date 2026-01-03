# TaskFlow - Enhanced Task Manager Features

## 📋 Overview
TaskFlow is a comprehensive React Native task management application with advanced features for organizing, prioritizing, and tracking your tasks.

## ✨ Key Features

### 1. **Due Dates & Reminders**
- Set specific dates and times for task reminders
- High-priority notification system (appears like phone calls on Android)
- Snooze functionality (5-minute intervals)
- Custom ringtone selection
- Vibration control
- Precise time validation to prevent past-date alarms

**How to use:**
1. Create a new task
2. Tap the bell icon to set a reminder
3. Select date and time
4. Save to schedule the notification

### 2. **Task Prioritization**
Three priority levels with visual color coding:
- **High Priority** (Red - #FF5252): Urgent tasks requiring immediate attention
- **Medium Priority** (Orange - #FFB142): Important tasks with moderate urgency
- **Low Priority** (Blue - #2CCCE4): Tasks that can be done when time permits

**Visual Indicators:**
- Colored left border on each task card
- Priority selector in task details modal

### 3. **Category Organization**
Organize tasks into predefined categories:
- **Work**: Professional and career-related tasks
- **Personal**: Personal errands and activities
- **Learning**: Educational and skill development tasks
- **Health**: Fitness, wellness, and medical appointments

**Features:**
- Category badge displayed on each task
- Easy category switching in task details
- Visual grouping for better organization

### 4. **Progress Tracking**
- Track task completion status
- Visual checkbox indicator
- Completed tasks show strikethrough text
- Smooth animations for status changes

### 5. **Advanced Notification System**
**Android-Specific Features:**
- `MAX` importance level for critical visibility
- Full-screen intent permission for call-like notifications
- Exact alarm scheduling permission
- Sticky notifications (won't auto-dismiss)
- Lock screen visibility
- Custom vibration patterns

**Permissions Required:**
- `android.permission.SCHEDULE_EXACT_ALARM`
- `android.permission.USE_FULL_SCREEN_INTENT`
- `android.permission.RECORD_AUDIO` (for custom sounds)

## 🎨 User Interface

### Task Card Display
Each task shows:
- ✅ Completion checkbox
- 📝 Task title
- 🏷️ Category badge
- ⏰ Reminder time (if set)
- 🎨 Priority color indicator (left border)
- 🔔 Bell icon (edit reminder)
- 🗑️ Delete icon

### Task Details Modal
Comprehensive editing interface:
- **Time Picker**: Large, easy-to-read time display
- **Date Picker**: Calendar-based date selection
- **Priority Selector**: Three-button toggle (High/Medium/Low)
- **Category Selector**: Four-button toggle (Work/Personal/Learning/Health)
- **Ringtone**: Custom audio file selection
- **Vibrate**: Toggle switch for vibration

## 🚀 Getting Started

### Installation
```bash
cd "a:\task man7\TaskManager"
npm install
npm start
```

### First-Time Setup
1. Grant notification permissions when prompted
2. On Android, ensure "Display over other apps" is enabled for Expo Go
3. Allow exact alarm scheduling for precise timing

## 📱 Usage Tips

### Creating Effective Tasks
1. **Be Specific**: Write clear, actionable task descriptions
2. **Set Priorities**: Use High for urgent, Medium for important, Low for nice-to-have
3. **Choose Categories**: Organize by life area for better focus
4. **Set Reminders**: Add due dates to stay on track

### Managing Notifications
- **Snooze**: When an alarm rings, tap "Snooze 5m" to postpone
- **Stop**: Tap "Stop" to dismiss the alarm
- **Edit**: Tap the bell icon to modify reminder settings

### Best Practices
- Review High priority tasks daily
- Group similar tasks by category
- Set realistic due dates
- Use reminders for time-sensitive tasks
- Complete or reschedule overdue tasks promptly

## 🔧 Technical Details

### State Management
- React Hooks (useState, useEffect, useRef)
- Local state for all task data
- Persistent notification scheduling

### Notification System
- expo-notifications for cross-platform support
- Android-specific channel configuration
- Custom sound support via expo-av
- Date/time validation to prevent errors

### UI Components
- React Native core components
- Feather icons for consistent design
- Modal-based editing interface
- Smooth LayoutAnimation transitions

## 🎯 Future Enhancements (Potential)
- [ ] Task search and filtering
- [ ] Sort by priority/category/date
- [ ] Recurring tasks (daily, weekly, monthly)
- [ ] Task notes and attachments
- [ ] Progress percentage tracking
- [ ] Statistics and analytics
- [ ] Cloud sync and backup
- [ ] Collaboration features
- [ ] Dark mode support

## 📝 Notes

### Known Limitations
- Expo Go has limitations for background notifications
- For production use, build a standalone app
- iOS notification behavior differs from Android
- Custom sounds require file picker access

### Troubleshooting
**Notifications not appearing:**
1. Check notification permissions
2. Verify "Display over other apps" (Android)
3. Ensure exact alarm permission is granted
4. Restart the app

**Alarms triggering immediately:**
- Fixed in current version with strict time validation
- Seconds/milliseconds are zeroed out for accurate comparison

**Sound not playing:**
- Check device volume
- Verify sound file format compatibility
- Ensure app has audio permissions

## 📄 License
This project is part of a task management learning exercise.

## 🤝 Contributing
This is a personal project, but suggestions are welcome!

---

**Version**: 3.0  
**Last Updated**: January 2026  
**Platform**: React Native (Expo)  
**Minimum Requirements**: Android 8.0+ / iOS 13.0+
