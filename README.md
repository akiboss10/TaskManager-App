# 🎯 TaskFlow - Professional Task Manager with Pro Alarms

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React Native](https://img.shields.io/badge/React%20Native-20232A?logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)

**TaskFlow** is a sleek, offline-capable Task Manager built with React Native. It features a professional-grade alarm system that works reliably even when your phone is locked or the app is closed.

---

## 📸 Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/e2b95637-6787-4d03-ad02-7828cf95cf35" width="250" />
  <img src="https://github.com/user-attachments/assets/664e7724-7439-44d0-ae7e-a4809cac0368" width="250" />
  <img src="https://github.com/user-attachments/assets/99ef705e-0d6f-4596-9332-e71ef50872fd" width="250" />
</p>



## ✨ Features

### 🛠️ Core Functionality
- **Add Tasks:** Quickly add tasks with a smooth, intuitive input.
- **Task List:** View your tasks in a performant `FlatList` with custom card designs.
- **Mark Completion:** One-tap to complete tasks with satisfying visual feedback.
- **Full Offline Mode:** All data is saved locally using `AsyncStorage`. No internet required.

### 🔔 Premium Alarm System
- **Background Reliability:** Alarms ring even if the app is killed or the phone is locked.
- **Continuous Vibration:** Looping vibration patterns to ensure you never miss a reminder.
- **Custom Ringtones:** Ability to pick any sound file from your device as your alarm tone.
- **Time Remaining:** Live countdowns showing exactly how much time is left for each alarm.
- **Live Digital Clock:** Precise real-time clock integrated into the header for perfect sync.

### 🛡️ Safety & Security
- **Permission Shield:** Ensures the app remains 100% reliable by verifying system notification rights before use.
- **High Priority Notifications:** Uses Android MAX importance channels for "Call-Like" reliability.

---

## 🚀 Tech Stack

- **Framework:** React Native (Functional Components & Hooks)
- **Environment:** Expo Managed Workflow
- **Storage:** @react-native-async-storage/async-storage
- **Multimedia:** expo-av (Audio), expo-notifications (Scheduling)
- **UI Icons:** Feather & MaterialIcons

---

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/task-manager.git
   cd task-manager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npx expo start
   ```

4. **Run on Device:**
   - Install the **Expo Go** app on your Android or iOS device.
   - Scan the QR code from the terminal to launch the app.

---

## 💡 Usage Tips

- **Background Alarms:** On Android, ensure you grant the **"Display over other apps"** permission for Expo Go to allow automatic full-screen alarm pop-ups.
- **Volume:** Adjust the Ringtone Volume slider in the alarm settings for immediate audio feedback.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ for high-performance productivity.
