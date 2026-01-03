import React, { useState, useEffect, useRef } from 'react';
// Force Refresh 3 - Full Atomic Update
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  LayoutAnimation,
  UIManager,
  Modal,
  Alert,
  Linking,
  Switch,
  ScrollView,
  Keyboard,
  Vibration,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Notification Handler Setup
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Global variable for sound to ensure persistence across renders
let globalSound = null;

export default function App() {
  const APP_URL = 'https://example.com';
  const [task, setTask] = useState('');
  const [taskItems, setTaskItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date()); // LIVE CLOCK
  const [permissionsGranted, setPermissionsGranted] = useState(true); // Track permission state

  // Alarm State
  const [reminderDate, setReminderDate] = useState(new Date());
  const [selectedSoundUri, setSelectedSoundUri] = useState(null);
  const [repeatDays, setRepeatDays] = useState([false, false, false, false, false, false, false]); // Sun-Sat
  const [isVibrate, setIsVibrate] = useState(true);
  const [volume, setVolume] = useState(0.7); // Ringtone volume (0-1)

  // Task Details State
  const [priority, setPriority] = useState('Medium'); // High, Medium, Low
  const [category, setCategory] = useState('Personal'); // Work, Personal, etc.

  // Pickers State
  const [isTimePickerVisible, setTimePickerVisibility] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const inputRef = useRef(null);

  // Alarm Ringing State
  const [ringingModalVisible, setRingingModalVisible] = useState(false);
  const [ringingTaskTitle, setRingingTaskTitle] = useState('');
  const previewSoundRef = useRef(null); // Ref for volume preview sound

  const lastTriggeredTimeRef = useRef(null);

  // CLOCK EFFECT - Updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // FORWARD ALARM WATCHER - Checks for due tasks in foreground
  useEffect(() => {
    const checkAlarms = () => {
      // Clean current time to the minute
      const now = new Date(currentTime);
      now.setSeconds(0);
      now.setMilliseconds(0);
      const nowTs = now.getTime();

      // Only check if we haven't checked this specific minute yet
      if (lastTriggeredTimeRef.current === nowTs) return;

      taskItems.forEach(item => {
        if (item.hasReminder && item.triggerDate && !item.completed) {
          const alarmTime = new Date(item.triggerDate);
          alarmTime.setSeconds(0);
          alarmTime.setMilliseconds(0);
          const alarmTs = alarmTime.getTime();

          // If current time matched alarm time EXACTLY
          if (nowTs === alarmTs && !ringingModalVisible) {
            console.log('🎯 FOREGROUND ALARM MATCH:', item.text);
            lastTriggeredTimeRef.current = nowTs;
            setRingingTaskTitle(item.text);
            setRingingModalVisible(true);
            if (item.reminderSound) {
              playAlarmSound(item.reminderSound, item.volume || 0.7);
            }
          }
        }
      });
    };

    checkAlarms();
  }, [currentTime, taskItems, ringingModalVisible]);

  const loadTasks = async () => {
    try {
      const savedTasks = await AsyncStorage.getItem('taskItems');
      if (savedTasks !== null) {
        setTaskItems(JSON.parse(savedTasks));
      }
    } catch (e) {
      console.log('Failed to load tasks', e);
    }
  };

  const saveTasks = async (tasks) => {
    try {
      await AsyncStorage.setItem('taskItems', JSON.stringify(tasks));
    } catch (e) {
      console.log('Failed to save tasks', e);
    }
  };

  // Auto-save on every task list change
  useEffect(() => {
    if (taskItems.length > 0) {
      saveTasks(taskItems);
    }
  }, [taskItems]);

  const getTimeRemaining = (triggerDate) => {
    const now = new Date();
    const future = new Date(triggerDate);
    const diff = future - now;

    if (diff <= 0) return "Due Now";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins}m left`;
  };

  useEffect(() => {
    // 1. CONFIGURE AUDIO FOR LOCK SCREEN / BACKGROUND
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) { console.log("Audio mode error", e); }
    };
    setupAudio();

    registerForPushNotificationsAsync();
    loadTasks();

    // Listener 1: Foreground Notifications (App is active)
    const subReceived = Notifications.addNotificationReceivedListener(async (notification) => {
      if (notification.request.content.title !== "Task Reminder 🔔") return;

      const data = notification.request.content.data;
      if (data.scheduledFor) {
        const scheduledTime = new Date(data.scheduledFor);
        const now = new Date();

        const diffInMs = scheduledTime.getTime() - now.getTime();

        // GRACE PERIOD: If it's within 10 seconds of target, allow it
        if (diffInMs > 10000) {
          console.log('⚠️ Notification received too early (>10s before), ignoring');
          return;
        }

        // If it's more than 2 minutes in the past, ignore it
        if (diffInMs < -120000) return;

        if (lastTriggeredTimeRef.current === scheduledTime.getTime() && ringingModalVisible) return;
      }

      const title = notification.request.content.body.replace("Don't forget: ", "");
      if (data.scheduledFor) {
        lastTriggeredTimeRef.current = data.scheduledFor;
      }
      setRingingTaskTitle(title);
      setRingingModalVisible(true);
      if (data.soundUri) playAlarmSound(data.soundUri, data.volume || 0.7);
    });

    // Listener 2: Background Notifications (Handle tap when app is closed)
    const subResponse = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const title = response.notification.request.content.body.replace("Don't forget: ", "");

      // Force app to trigger alarm screen immediately upon opening
      setRingingTaskTitle(title);
      setRingingModalVisible(true);
      if (data.soundUri) playAlarmSound(data.soundUri, data.volume || 0.7);
    });

    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  }, [ringingModalVisible]);

  const playAlarmSound = async (uri, playbackVolume = 0.7) => {
    try {
      console.log("🔊 Attempting to play alarm sound...");
      // 1. Safety: Stop any existing main sound
      if (globalSound) {
        try {
          await globalSound.stopAsync();
          await globalSound.unloadAsync();
          globalSound = null;
        } catch (e) { console.log('Error cleaning prev sound', e); }
      }

      // 2. Safety: Stop any preview sound
      if (previewSoundRef.current) {
        try {
          await previewSoundRef.current.unloadAsync();
          previewSoundRef.current = null;
        } catch (e) { }
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, isLooping: true, volume: playbackVolume }
      );
      globalSound = sound;

      // 3. Handle Continuous Vibration
      if (isVibrate) {
        Vibration.vibrate([0, 500, 200, 500], true); // Loop until stopped
      }

      console.log("✅ Alarm sound and vibration playing");
    } catch (error) {
      console.log("❌ Failed to play alarm", error);
    }
  };

  const stopAlarm = async () => {
    console.log("🛑 Stopping alarm...");
    try {
      // 1. Stop main alarm
      if (globalSound) {
        try {
          await globalSound.stopAsync();
          await globalSound.unloadAsync();
        } catch (e) { console.log('Error stopping globalSound', e); }
        globalSound = null;
      }

      // 2. Stop any preview sound
      if (previewSoundRef.current) {
        try {
          await previewSoundRef.current.unloadAsync();
        } catch (e) { }
        previewSoundRef.current = null;
      }

      // 3. Stop Vibration
      Vibration.cancel();

    } catch (error) {
      console.log("Error in stopAlarm sequence", error);
    } finally {
      // 4. Force UI state reset
      setRingingModalVisible(false);
      console.log("📱 UI Reset: Alarm screen closed and Vibration stopped");
    }
  };

  const snoozeAlarm = async () => {
    try {
      // 1. Stop current alarm (music/screen)
      await stopAlarm();

      // 2. Schedule new one
      const snoozeDate = new Date();
      snoozeDate.setMinutes(snoozeDate.getMinutes() + 5);
      // Zero out seconds specifically for snooze to ensure clean scheduling
      snoozeDate.setSeconds(0);
      snoozeDate.setMilliseconds(0);

      // Pass the SAME sound, and isSnooze=true to bypass validation
      await scheduleNotification(ringingTaskTitle, snoozeDate, [], selectedSoundUri, true);

      Alert.alert("Snoozed", `Alarm snoozed for 5 minutes.\nWill ring again at ${formatTime(snoozeDate)}`);
    } catch (error) {
      console.log("Snooze error:", error);
      Alert.alert("Error", "Failed to snooze alarm. Please try again.");
    }
  };

  const adjustVolume = async (newVolume) => {
    const roundedVolume = Math.round(newVolume * 10) / 10;
    setVolume(roundedVolume);

    try {
      // 1. Stop previous preview if playing
      if (previewSoundRef.current) {
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }

      // 2. Play a short preview
      if (selectedSoundUri) {
        const { sound: previewSound } = await Audio.Sound.createAsync(
          { uri: selectedSoundUri },
          { shouldPlay: true, volume: roundedVolume }
        );
        previewSoundRef.current = previewSound;

        // Auto stop after 1 sec
        setTimeout(async () => {
          try {
            if (previewSoundRef.current === previewSound) {
              await previewSound.unloadAsync();
              previewSoundRef.current = null;
            }
          } catch (e) { }
        }, 1000);
      } else {
        // Optionally play default system sound or alert
        console.log("No ringtone selected for preview");
      }
    } catch (error) {
      console.log("Volume preview error", error);
    }
  };

  const [barWidth, setBarWidth] = useState(0);
  const handleBarTouch = (event) => {
    if (barWidth <= 0) return;
    const touchX = event.nativeEvent.locationX;
    const ratio = Math.min(1, Math.max(0, touchX / barWidth));
    adjustVolume(ratio);
  };

  // -------------------------------------------------------------
  // UPDATED CONFIGURATION WITH MAX PRIORITY FOR "CALL-LIKE" FEEL
  // -------------------------------------------------------------
  const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('task-reminders-v2', {
        name: 'Task Alarms',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#6C5CE7',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: true,
        enableVibrate: true,
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setPermissionsGranted(finalStatus === 'granted');

    if (finalStatus !== 'granted') {
      // Handled by UI Shield
    } else {
      if (Platform.OS === 'android') {
        console.log("🔔 Alarms active. Tip: For full-screen pop-ups while backgrounded, enable 'Display over other apps' for Expo Go.");
      }
    }
  };

  const openAppUrl = async () => {
    try {
      const supported = await Linking.canOpenURL(APP_URL);
      if (supported) {
        await Linking.openURL(APP_URL);
      } else {
        Alert.alert('Cannot open URL', APP_URL);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open URL');
    }
  };

  const scheduleNotification = async (taskText, triggerDate, repeatingDays = [], soundUriOverride = null, isSnooze = false) => {
    try {
      // 1. Clean data
      const cleanDate = new Date(triggerDate);
      cleanDate.setSeconds(0);
      cleanDate.setMilliseconds(0);

      const soundToUse = soundUriOverride || selectedSoundUri;
      const isRepeating = repeatingDays && repeatingDays.some(day => day === true);

      const now = new Date();
      // Also clean 'now' for fair Minute-to-Minute comparison
      now.setSeconds(0);
      now.setMilliseconds(0);

      // DEBUG LOGGING
      console.log('=== ALARM SCHEDULING ===');
      console.log('Device:', formatDateTime(now), '|', now.getTime());
      console.log('Selected:', formatDateTime(cleanDate), '|', cleanDate.getTime());
      console.log('Diff (min):', Math.round((cleanDate.getTime() - now.getTime()) / 60000));
      console.log('=======================');

      // 2. STRICT VALIDATION
      // Skipped if it's a Snooze (guaranteed future) or Repeating
      if (!isRepeating && !isSnooze) {
        // Strict check: If cleanDate is STRICTLY LESS than now, it's past.
        // Equal is allowed (Current Minute).
        if (cleanDate.getTime() < now.getTime()) {
          Alert.alert(
            "Time Error",
            `Device: ${formatDateTime(now)}\nSelected: ${formatDateTime(cleanDate)}\n\nYou cannot select a time in the past.`
          );
          return;
        }
      }

      // Common Notification Content
      const notificationContent = {
        title: "Task Reminder 🔔",
        body: `Don't forget: ${taskText}`,
        sound: true,
        data: {
          soundUri: soundToUse,
          volume: volume,
          createdAt: Date.now(),
          scheduledFor: cleanDate.getTime(),
          isAlarm: true
        },
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 200, 500],
        channelId: 'task-reminders-v2',
        autoDismiss: false,
        sticky: true,
      };

      if (isRepeating) {
        // Schedule for each selected day
        let scheduledCount = 0;
        for (let i = 0; i < repeatingDays.length; i++) {
          if (repeatingDays[i]) {
            await Notifications.scheduleNotificationAsync({
              content: notificationContent,
              trigger: {
                weekday: i + 1,
                hour: cleanDate.getHours(),
                minute: cleanDate.getMinutes(),
                repeats: true,
                channelId: 'task-reminders-v2',
              },
            });
            scheduledCount++;
          }
        }
        Alert.alert("Alarm Set", `Repeating reminder set!`);
      } else {
        // One-time Notification
        await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            channelId: 'task-reminders-v2',
            date: cleanDate,
            // android: { exact: true } // Attempting exact delivery if permitted
          },
        });

        // 3. User Confirmation of Exact Time
        Alert.alert("Alarm Set", `Reminder set for:\n${formatDateTime(cleanDate)}`);
      }

    } catch (error) {
      console.log(error);
      Alert.alert("Error", error.message || "Could not schedule notification.");
    }
  };

  const handleAddTask = () => {
    if (task.trim().length === 0) {
      inputRef.current?.focus();
      return;
    }

    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const newTask = {
      id: Date.now().toString(),
      text: task,
      completed: false,
      hasReminder: false,
      reminderTime: null,
      triggerDate: null,
      priority: 'Medium',
      category: 'Personal',
      progress: 0,
    };

    setTaskItems([...taskItems, newTask]);
    setTask('');
    openAlarmModal(newTask);
  };

  const toggleComplete = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTaskItems(
      taskItems.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const deleteTask = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTaskItems(taskItems.filter(item => item.id !== id));
  };

  const handleDeleteTask = (id) => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteTask(id)
        }
      ]
    );
  };

  const openAlarmModal = (item) => {
    setSelectedTask(item);
    if (item && item.triggerDate) {
      setReminderDate(new Date(item.triggerDate));
    } else {
      setReminderDate(new Date());
    }
    setPriority(item.priority || 'Medium');
    setCategory(item.category || 'Personal');
    setSelectedSoundUri(item && item.reminderSound ? item.reminderSound : null);
    setRepeatDays(item && item.repeatDays ? item.repeatDays : [false, false, false, false, false, false, false]);
    setIsVibrate(item && item.isVibrate !== undefined ? item.isVibrate : true);
    setVolume(item && item.volume !== undefined ? item.volume : 0.7);
    setModalVisible(true);
  };

  // --- Date/Time Formatting & Pickers ---
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (date) => {
    return `${formatDate(date)} at ${formatTime(date)}`;
  };

  const handleConfirmTime = (date) => {
    const newDate = new Date(reminderDate);
    newDate.setHours(date.getHours(), date.getMinutes());
    setReminderDate(newDate);
    setTimePickerVisibility(false);
  };

  const handleConfirmDate = (date) => {
    const newDate = new Date(reminderDate);
    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setReminderDate(newDate);
    setDatePickerVisibility(false);
  };

  const toggleDay = (index) => {
    const newDays = [...repeatDays];
    newDays[index] = !newDays[index];
    setRepeatDays(newDays);
  };

  const pickSound = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.assets && res.assets.length > 0) {
        setSelectedSoundUri(res.assets[0].uri);
      } else if (res.type === 'success') {
        setSelectedSoundUri(res.uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick sound');
    }
  };

  const handleSaveAlarm = () => {
    scheduleNotification(selectedTask.text, reminderDate, repeatDays);
    const updatedItems = taskItems.map(item =>
      item.id === selectedTask.id
        ? {
          ...item,
          hasReminder: true,
          reminderTime: formatTime(reminderDate),
          triggerDate: reminderDate.toISOString(),
          reminderSound: selectedSoundUri,
          repeatDays,
          isVibrate,
          priority,
          category,
          volume
        }
        : item
    );
    setTaskItems(updatedItems);
    setModalVisible(false);
    setSelectedTask(null);
  };

  const handleSkipReminder = () => {
    // Save task with priority/category but NO reminder
    const updatedItems = taskItems.map(item =>
      item.id === selectedTask.id
        ? {
          ...item,
          priority,
          category,
          hasReminder: false,
          reminderTime: null,
          triggerDate: null
        }
        : item
    );
    setTaskItems(updatedItems);
    setModalVisible(false);
    setSelectedTask(null);
  };

  const getPriorityColor = (p) => {
    switch (p) {
      case 'High': return '#FF5252';
      case 'Medium': return '#FFB142';
      case 'Low': return '#2CCCE4';
      default: return '#B2BEC3';
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={[styles.item, { borderLeftColor: getPriorityColor(item.priority) }]}
        onPress={() => toggleComplete(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.square, item.completed && styles.squareCompleted]}>
            {item.completed && <Feather name="check" size={14} color="#FFF" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]} numberOfLines={2}>
              {item.text}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <View style={[styles.categoryBadge, { marginRight: 8 }]}>
                <Text style={styles.categoryText}>{item.category || 'Personal'}</Text>
              </View>

              {item.hasReminder && !item.completed ? (
                <View style={[styles.reminderBadge, { backgroundColor: '#F0EFFF' }]}>
                  <Feather name="clock" size={10} color="#6C5CE7" style={{ marginRight: 4 }} />
                  <Text style={styles.reminderText}>
                    {formatTime(new Date(item.triggerDate))} • {getTimeRemaining(item.triggerDate)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => openAlarmModal(item)} style={styles.actionBtn}>
            <Feather name="bell" size={20} color={item.hasReminder ? "#6C5CE7" : "#B2BEC3"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteTask(item.id)} style={[styles.actionBtn, { marginLeft: 10 }]}>
            <Feather name="trash-2" size={20} color="#FF5252" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );

  if (!permissionsGranted) {
    return (
      <SafeAreaView style={styles.permissionShieldContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#1C1C1E" />
        <View style={styles.permissionShieldContent}>
          <View style={styles.permissionIconCircle}>
            <Feather name="shield" size={60} color="#FF5252" />
          </View>
          <Text style={styles.permissionShieldTitle}>Alarm Access Required</Text>
          <Text style={styles.permissionShieldText}>
            To make your alarms work **everywhere** (when locked, backgrounded, or closed), we need your permission to send High-Priority Notifications.
          </Text>
          <Text style={styles.permissionShieldTextSmall}>
            This is a **Necessary Feature** for TaskFlow to ring reliably.
          </Text>

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => {
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Linking.openSettings();
              }
              // Immediately check again after few seconds
              setTimeout(registerForPushNotificationsAsync, 3000);
            }}
          >
            <Text style={styles.permissionButtonText}>Allow in Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permissionRetryLink}
            onPress={registerForPushNotificationsAsync}
          >
            <Text style={styles.permissionRetryText}>I've allowed it, check again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF9F0" />
      <View style={styles.tasksWrapper}>
        <View style={styles.headerTop}>
          <Text style={styles.sectionTitle}>TaskFlow</Text>
          <View style={styles.clockContainer}>
            <Text style={styles.clockDate}>{formatDate(currentTime)}</Text>
            <Text style={styles.clockTime}>{formatTime(currentTime)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.urlButton} onPress={openAppUrl} activeOpacity={0.8}>
          <Text style={styles.urlButtonText}>Open App URL</Text>
        </TouchableOpacity>



        <View style={styles.items}>
          {taskItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.illustrationPlaceholder}>
                <Feather name="clipboard" size={80} color="#FFD54F" />
                <View style={styles.illustrationDecor}>
                  <Feather name="clock" size={40} color="#FF7043" />
                </View>
              </View>
              <Text style={styles.emptyTextTitle}>Add First Task</Text>
              <View style={styles.arrowContainer}>
                <Feather name="corner-right-down" size={80} color="#1E88E5" style={styles.arrowIcon} />
              </View>
            </View>
          ) : (
            <FlatList
              data={taskItems}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.writeTaskWrapper}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={'Enter Quick Task Here'}
          placeholderTextColor="#BBDEFB"
          value={task}
          onChangeText={text => setTask(text)}
          onSubmitEditing={handleAddTask}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={handleAddTask} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} activeOpacity={0.6}>
          <View style={styles.addWrapper}>
            <Feather name="plus" size={30} color="#1E88E5" />
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Enhanced Alarm Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alarmModalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Skip</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeading}>Set Alarm</Text>
              <TouchableOpacity onPress={handleSaveAlarm}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <TouchableOpacity onPress={() => setTimePickerVisibility(true)} style={styles.timeDisplayContainer}>
                <Text style={styles.bigTimeText}>{formatTime(reminderDate)}</Text>
                <Text style={styles.editLabel}>Tap to change time</Text>
              </TouchableOpacity>
              <View style={styles.settingsGroup}>
                <TouchableOpacity style={styles.settingRow} onPress={() => setDatePickerVisibility(true)}>
                  <View style={styles.settingLabelContainer}>
                    <Text style={styles.settingLabel}>Date</Text>
                  </View>
                  <View style={styles.settingValueContainer}>
                    <Text style={styles.settingValue}>{formatDate(reminderDate)}</Text>
                    <Feather name="chevron-right" size={20} color="#B2BEC3" />
                  </View>
                </TouchableOpacity>
              </View>



              {/* Priority & Category - Combined in ONE Group */}
              <Text style={styles.sectionHeader}>Priority & Category</Text>
              <View style={styles.settingsGroup}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Priority</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['High', 'Medium', 'Low'].map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setPriority(p)}
                        style={[
                          styles.priorityChip,
                          { backgroundColor: priority === p ? getPriorityColor(p) : '#F0F0F0' }
                        ]}
                      >
                        <Text style={[
                          styles.priorityChipText,
                          { color: priority === p ? '#FFF' : '#636E72' }
                        ]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.separator} />
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Category</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {['Work', 'Personal', 'Learning', 'Health'].map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setCategory(c)}
                        style={[
                          styles.categoryChip,
                          { backgroundColor: category === c ? '#6C5CE7' : '#F0F0F0' }
                        ]}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          { color: category === c ? '#FFF' : '#636E72' }
                        ]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Repeat section removed as per user request */}
              <Text style={styles.sectionHeader}>Options</Text>
              <View style={styles.settingsGroup}>
                <TouchableOpacity style={styles.settingRow} onPress={pickSound}>
                  <Text style={styles.settingLabel}>Ringtone</Text>
                  <View style={styles.settingValueContainer}>
                    <Text style={styles.settingValue} numberOfLines={1}>
                      {selectedSoundUri ? decodeURI(selectedSoundUri.split('/').pop()) : 'Default'}
                    </Text>
                    <Feather name="chevron-right" size={20} color="#B2BEC3" />
                  </View>
                </TouchableOpacity>
                <View style={styles.separator} />
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Vibrate</Text>
                  <Switch
                    trackColor={{ false: "#767577", true: "#A29BFE" }}
                    thumbColor={isVibrate ? "#6C5CE7" : "#f4f3f4"}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={() => setIsVibrate(prev => !prev)}
                    value={isVibrate}
                  />
                </View>
                <View style={styles.separator} />
                <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 16 }]}>
                  <Text style={[styles.settingLabel, { marginBottom: 15 }]}>Ringtone Volume</Text>
                  <View style={styles.volumeControlsContainer}>
                    <TouchableOpacity
                      onPress={() => adjustVolume(Math.max(0, volume - 0.1))}
                      style={styles.volumeBtn}
                      activeOpacity={0.7}
                    >
                      <Feather name="minus" size={24} color="#6C5CE7" />
                    </TouchableOpacity>

                    <View
                      style={styles.volumeProgressOuter}
                      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                      onStartShouldSetResponder={() => true}
                      onResponderRelease={handleBarTouch}
                    >
                      <View style={[styles.volumeProgressInner, { width: `${volume * 100}%` }]} />
                    </View>

                    <TouchableOpacity
                      onPress={() => adjustVolume(Math.min(1, volume + 0.1))}
                      style={styles.volumeBtn}
                      activeOpacity={0.7}
                    >
                      <Feather name="plus" size={24} color="#6C5CE7" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            <DateTimePickerModal
              isVisible={isTimePickerVisible}
              mode="time"
              onConfirm={handleConfirmTime}
              onCancel={() => setTimePickerVisibility(false)}
              date={reminderDate}
              is24Hour={true}
            />
            <DateTimePickerModal
              isVisible={isDatePickerVisible}
              mode="date"
              onConfirm={handleConfirmDate}
              onCancel={() => setDatePickerVisibility(false)}
              date={reminderDate}
              minimumDate={new Date()}
            />
          </View>
        </View>
      </Modal>

      {/* Alarm Ringing Full Screen Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={ringingModalVisible}
        onRequestClose={stopAlarm}
      >
        <View style={styles.ringingContainer}>
          <Text style={styles.ringingClock}>{formatTime(currentTime)}</Text>
          <Feather name="bell" size={60} color="#FFD700" style={{ marginVertical: 20 }} />
          <Text style={styles.ringingLabel}>Alarm</Text>
          <Text style={styles.ringingTitle}>{ringingTaskTitle}</Text>

          <View style={styles.ringingButtonsContainer}>
            <TouchableOpacity style={styles.snoozeButton} onPress={snoozeAlarm}>
              <Text style={styles.snoozeText}>Snooze 5m</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.stopButton} onPress={stopAlarm}>
              <Text style={styles.stopText}>Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9F0',
  },
  tasksWrapper: {
    paddingTop: 40,
    paddingHorizontal: 20,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  clockContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    alignItems: 'flex-end',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  clockTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C5CE7',
  },
  clockDate: {
    fontSize: 12,
    color: '#B2BEC3',
    fontWeight: '600',
  },
  offlineStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#00B89422',
  },
  offlineStatusText: {
    fontSize: 11,
    color: '#00B894',
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urlButton: {
    backgroundColor: '#EDE7F6',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  urlButtonText: {
    color: '#673AB7',
    fontWeight: '600',
    fontSize: 14,
  },
  items: {
    paddingBottom: 20,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  illustrationPlaceholder: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  illustrationDecor: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 5,
  },
  emptyTextTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E88E5',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  arrowContainer: {
    marginTop: 20,
    transform: [{ rotate: '10deg' }],
  },
  arrowIcon: {
    opacity: 0.8,
  },
  writeTaskWrapper: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1E88E5',
    paddingBottom: Platform.OS === 'ios' ? 40 : 15,
    zIndex: 10,
    elevation: 10,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: 'transparent',
    borderRadius: 30,
    borderColor: 'transparent',
    borderWidth: 0,
    flex: 1,
    marginRight: 20,
    fontSize: 16,
    color: '#FFFFFF',
  },
  addWrapper: {
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  itemContainer: {
    marginBottom: 20,
  },
  item: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  square: {
    width: 24,
    height: 24,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareCompleted: {
    backgroundColor: '#6C5CE7',
  },
  itemText: {
    maxWidth: '100%',
    fontSize: 16,
    color: '#2D3436',
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#B2BEC3',
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  reminderText: {
    fontSize: 12,
    color: '#673AB7',
    fontWeight: '500',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 11,
    color: '#1976D2',
    fontWeight: '600',
  },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  volumeControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
    paddingRight: 10,
  },
  volumeBtn: {
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  volumeProgressOuter: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginHorizontal: 15,
    overflow: 'hidden',
  },
  volumeProgressInner: {
    height: '100%',
    backgroundColor: '#6C5CE7',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  alarmModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  modalCancelText: {
    color: '#B2BEC3',
    fontSize: 16,
    fontWeight: '500',
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  modalSaveText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    paddingBottom: 40,
  },
  timeDisplayContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  bigTimeText: {
    fontSize: 64,
    fontWeight: '200',
    color: '#2D3436',
    letterSpacing: 2,
  },
  editLabel: {
    color: '#6C5CE7',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  settingsGroup: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  settingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 16,
    color: '#636E72',
    marginRight: 8,
    maxWidth: 150,
  },
  separator: {
    height: 1,
    backgroundColor: '#DFE6E9',
    marginVertical: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B2BEC3',
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  repeatContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  dayBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE6E9',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  dayBubbleActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B2BEC3',
  },
  dayTextActive: {
    color: '#FFF',
  },
  ringingContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  ringingClock: {
    fontSize: 72,
    fontWeight: '200',
    color: '#FFF',
    letterSpacing: 4,
  },
  ringingLabel: {
    color: '#B2BEC3',
    fontSize: 20,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  ringingTitle: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 80,
  },
  ringingButtonsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  snoozeButton: {
    backgroundColor: '#FFEAA7',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 50,
    width: '80%',
    alignItems: 'center',
  },
  snoozeText: {
    color: '#2D3436',
    fontSize: 20,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#FF5252',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    width: '80%',
    alignItems: 'center',
    marginTop: 10,
  },
  stopText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  permissionShieldContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionShieldContent: {
    padding: 30,
    alignItems: 'center',
  },
  permissionIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF525222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  permissionShieldTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionShieldText: {
    fontSize: 16,
    color: '#D1D1D6',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 15,
  },
  permissionShieldTextSmall: {
    fontSize: 14,
    color: '#FFB142',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 40,
    textTransform: 'uppercase',
  },
  permissionButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 50,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  permissionRetryLink: {
    padding: 10,
  },
  permissionRetryText: {
    color: '#B2BEC3',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
