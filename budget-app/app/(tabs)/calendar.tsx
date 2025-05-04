// app/(tabs)/calendar.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Calendar
        style={styles.calendar}
        onDayPress={(day) => {
          console.log('Selected day', day);
        }}
        markedDates={{
          '2025-05-03': { selected: true, marked: true, selectedColor: '#4CAF50' },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: 'white',
  },
  calendar: {
    borderRadius: 10,
    elevation: 3,
    margin: 16,
  },
});
