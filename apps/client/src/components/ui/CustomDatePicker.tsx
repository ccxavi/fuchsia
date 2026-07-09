import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, useWindowDimensions, TouchableWithoutFeedback } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export interface CustomDatePickerProps {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onChange: (event: any, date?: Date) => void;
}

export function CustomDatePicker({ visible, value, onClose, onChange }: CustomDatePickerProps) {
  const { width } = useWindowDimensions();
  
  const [currentMonth, setCurrentMonth] = useState(new Date(value));
  const [pickerMode, setPickerMode] = useState<'days' | 'month' | 'year'>('days');
  const [yearPageStart, setYearPageStart] = useState(Math.floor(new Date(value).getFullYear() / 12) * 12);

  useEffect(() => {
    if (visible && value) {
      const valDate = new Date(value);
      setCurrentMonth(valDate);
      setYearPageStart(Math.floor(valDate.getFullYear() / 12) * 12);
      setPickerMode('days');
    }
  }, [value, visible]);

  const changeMonth = (offset: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  
  const firstDayObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  let firstDayOfMonth = firstDayObj.getDay();
  // Adjust so Monday is 0
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  const startingEmptyCells = firstDayOfMonth;
  
  const calendarDays = [];
  for (let i = 0; i < startingEmptyCells; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }
  const remainingCells = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 0; i < remainingCells; i++) {
    calendarDays.push(null);
  }

  const todayDateObj = new Date();
  const todayStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
  
  const selectedStr = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const modalInnerWidth = width - 80;
  const cellWidth = Math.floor((modalInnerWidth - 24) / 7);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dialogContainer, { width: width - 40 }]}>
              
              {pickerMode === 'month' && (
                <View>
                  <View style={styles.header}>
                    <Pressable onPress={() => setPickerMode('days')} style={styles.navButton}>
                      <ChevronLeft size={20} color={FuchsiaColors.ink} />
                    </Pressable>
                    <ThemedText style={styles.monthText}>Select Month</ThemedText>
                    <View style={{ width: 36 }} />
                  </View>
                  <View style={styles.monthsGrid}>
                    {monthNames.map((mName, index) => {
                      const isSelected = index === currentMonth.getMonth();
                      return (
                        <Pressable
                          key={mName}
                          style={[styles.monthPill, isSelected && styles.monthPillSelected]}
                          onPress={() => {
                            setCurrentMonth(new Date(currentMonth.getFullYear(), index, 1));
                            setPickerMode('days');
                          }}
                        >
                          <Text style={[styles.monthPillText, isSelected && styles.monthPillTextSelected]}>
                            {mName.substring(0, 3)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {pickerMode === 'year' && (
                <View>
                  <View style={styles.header}>
                    <Pressable onPress={() => setYearPageStart(y => y - 12)} style={styles.navButton}>
                      <ChevronLeft size={20} color={FuchsiaColors.ink} />
                    </Pressable>
                    <ThemedText style={styles.monthText}>{yearPageStart} - {yearPageStart + 11}</ThemedText>
                    <Pressable onPress={() => setYearPageStart(y => y + 12)} style={styles.navButton}>
                      <ChevronRight size={20} color={FuchsiaColors.ink} />
                    </Pressable>
                  </View>
                  <View style={styles.monthsGrid}>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const yearNum = yearPageStart + i;
                      const isSelected = yearNum === currentMonth.getFullYear();
                      return (
                        <Pressable
                          key={yearNum}
                          style={[styles.monthPill, isSelected && styles.monthPillSelected]}
                          onPress={() => {
                            setCurrentMonth(new Date(yearNum, currentMonth.getMonth(), 1));
                            setPickerMode('days');
                          }}
                        >
                          <Text style={[styles.monthPillText, isSelected && styles.monthPillTextSelected]}>
                            {yearNum}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {pickerMode === 'days' && (
                <View>
                  <View style={styles.header}>
                    <Pressable onPress={() => changeMonth(-1)} style={styles.navButton}>
                      <ChevronLeft size={20} color={FuchsiaColors.slate} />
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable 
                        style={styles.headerActionPill}
                        onPress={() => setPickerMode('month')}
                      >
                        <ThemedText style={styles.monthText}>
                          {monthNames[currentMonth.getMonth()]}
                        </ThemedText>
                      </Pressable>
                      <Pressable 
                        style={styles.headerActionPill}
                        onPress={() => {
                          setYearPageStart(Math.floor(currentMonth.getFullYear() / 12) * 12);
                          setPickerMode('year');
                        }}
                      >
                        <ThemedText style={styles.monthText}>
                          {currentMonth.getFullYear()}
                        </ThemedText>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => changeMonth(1)} style={styles.navButton}>
                      <ChevronRight size={20} color={FuchsiaColors.slate} />
                    </Pressable>
                  </View>

                  <View style={styles.dayLabelsRow}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <Text key={day} style={[styles.dayLabel, { width: cellWidth }]}>{day}</Text>
                    ))}
                  </View>

                  <View style={styles.daysGrid}>
                    {calendarDays.map((dayNum, index) => {
                      const cellStyle = { width: cellWidth, height: cellWidth };
                      
                      if (dayNum === null) {
                        return <View key={`empty-${index}`} style={[cellStyle, { marginBottom: 4 }]} />;
                      }

                      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedStr;

                      return (
                        <Pressable
                          key={dateStr}
                          style={[
                            styles.cell,
                            cellStyle,
                            isSelected && styles.cellSelected,
                          ]}
                          onPress={() => {
                            const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum);
                            onChange({ type: 'set' }, newDate);
                          }}
                        >
                          <Text style={[
                            styles.cellText,
                            isToday && !isSelected && styles.cellTextToday,
                            isSelected && styles.cellTextSelected,
                          ]}>
                            {dayNum}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  headerActionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: FuchsiaColors.cloud,
  },
  monthText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    color: FuchsiaColors.deep,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.slate,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: 100, 
  },
  cellSelected: {
    backgroundColor: FuchsiaColors.vibrant,
  },
  cellText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.deep,
  },
  cellTextToday: {
    color: FuchsiaColors.vibrant,
    fontFamily: FuchsiaFonts.bodySemiBold,
  },
  cellTextSelected: {
    color: '#FFFFFF',
    fontFamily: FuchsiaFonts.bodySemiBold,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 16,
  },
  monthPill: {
    width: '28%',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: FuchsiaColors.cloud,
  },
  monthPillSelected: {
    backgroundColor: FuchsiaColors.vibrant,
  },
  monthPillText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.slate,
  },
  monthPillTextSelected: {
    color: '#fff',
  },
});
