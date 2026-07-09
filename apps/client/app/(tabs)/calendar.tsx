import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions, Modal, Alert, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, Shirt, Sparkles, Calendar, X, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';

import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getCalendarOutfits, CalendarOutfitWithOutfitResponse, updateCalendarOutfit, deleteCalendarOutfit } from '@/api/client';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { CustomAlert } from '@/components/ui/CustomAlert';

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [outfits, setOutfits] = useState<CalendarOutfitWithOutfitResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentMonth.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(currentMonth.getMonth());
  
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);
  const [isDayModalVisible, setIsDayModalVisible] = useState(false);
  const [rescheduleOutfitId, setRescheduleOutfitId] = useState<string | null>(null);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchOutfits(currentMonth);
    }, [currentMonth])
  );

  const fetchOutfits = async (monthDate: Date) => {
    try {
      setIsLoading(true);
      const data = await getCalendarOutfits(monthDate.getFullYear(), monthDate.getMonth() + 1);
      setOutfits(data);
    } catch (error) {
      console.error('Failed to fetch outfits for calendar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRescheduleDateChange = async (event: any, date?: Date) => {
    setShowReschedulePicker(false);
    if (event.type === 'set' && date && rescheduleOutfitId) {
      try {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        const calendarOutfitToMove = outfits.find(o => o.id === rescheduleOutfitId);
        if (calendarOutfitToMove) {
          const existingOutfitsForDate = outfitsByDate[dateStr] || [];
          const isDuplicate = existingOutfitsForDate.some(co => co.outfit.id === calendarOutfitToMove.outfit.id);
          
          if (isDuplicate) {
            DeviceEventEmitter.emit('showGlobalAlert', {
              title: 'Duplicate Outfit',
              message: 'This outfit is already scheduled on that day!',
            });
            setRescheduleOutfitId(null);
            return;
          }
        }

        setIsLoading(true);
        await updateCalendarOutfit(rescheduleOutfitId, { date: dateStr });
        
        if (date.getFullYear() !== currentMonth.getFullYear() || date.getMonth() !== currentMonth.getMonth()) {
          setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          setIsDayModalVisible(false);
        } else {
          await fetchOutfits(currentMonth);
          setIsDayModalVisible(false);
        }
      } catch (err) {
        console.error('Failed to reschedule:', err);
        DeviceEventEmitter.emit('showGlobalAlert', {
          title: 'Error',
          message: 'Failed to reschedule outfit',
        });
      } finally {
        setIsLoading(false);
        setRescheduleOutfitId(null);
      }
    } else {
      setRescheduleOutfitId(null);
    }
  };

  const handleRemove = (id: string) => {
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Remove Outfit',
      message: 'Are you sure you want to remove this outfit from the schedule?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: () => confirmRemove(id),
    });
  };

  const confirmRemove = async (id: string) => {
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Removing...',
      message: 'Please wait while we remove this outfit from your schedule.',
      isLoading: true,
    });
    try {
      await deleteCalendarOutfit(id);
      await fetchOutfits(currentMonth);
      const remainingOutfits = outfitsByDate[selectedDayStr!]?.filter(o => o.id !== id) || [];
      if (remainingOutfits.length === 0) {
        setIsDayModalVisible(false);
      }
      DeviceEventEmitter.emit('hideGlobalAlert');
    } catch (err) {
      console.error('Failed to remove outfit:', err);
      DeviceEventEmitter.emit('hideGlobalAlert');
      DeviceEventEmitter.emit('showGlobalToast', 'Failed to remove outfit');
    }
  };

  const outfitsByDate = outfits.reduce((acc, calendarOutfit) => {
    const dateStr = calendarOutfit.date;
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(calendarOutfit);
    return acc;
  }, {} as Record<string, CalendarOutfitWithOutfitResponse[]>);

  const changeMonth = (offset: number) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(newMonth);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const startingEmptyCells = (firstDayOfMonth + 6) % 7;
  
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

  const currentMonthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  
  let totalOutfitsThisMonth = 0;
  let aiPicksThisMonth = 0;

  Object.entries(outfitsByDate).forEach(([dateStr, calendarOutfits]) => {
    if (dateStr.startsWith(currentMonthStr)) {
      totalOutfitsThisMonth += calendarOutfits.length;
      aiPicksThisMonth += calendarOutfits.filter(co => co.outfit.is_ai_generated).length;
    }
  });

  const todayDateObj = new Date();
  const todayStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
  const todaysOutfits = outfitsByDate[todayStr] || [];
  const todaysOutfit = todaysOutfits.length > 0 ? todaysOutfits[0].outfit : null;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const cellWidth = (width - 40 - (6 * 4)) / 7; // 40 = px-5*2, 6 gaps of 4px

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Outfit Calendar</ThemedText>
        <View style={{ width: 40, height: 40 }} />
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => changeMonth(-1)} style={styles.navButton}>
          <ChevronLeft size={16} color={FuchsiaColors.slate} />
        </Pressable>
        <Pressable onPress={() => {
          setPickerYear(currentMonth.getFullYear());
          setPickerMonth(currentMonth.getMonth());
          setIsPickerVisible(true);
        }}>
          <ThemedText style={styles.monthText}>
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => changeMonth(1)} style={styles.navButton}>
          <ChevronRight size={16} color={FuchsiaColors.slate} />
        </Pressable>
      </View>

      {isLoading && outfits.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={FuchsiaColors.vibrant} />
        </View>
      ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.gridContainer}>
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
                const scheduledOutfits = outfitsByDate[dateStr] || [];

                if (scheduledOutfits.length > 0) {
                  // Helper to get the images to show for an outfit
                  const getOutfitImages = (outfit: any): string[] => {
                    if (outfit.images && outfit.images.length > 0) return [outfit.images[0].image_url];
                    if (outfit.image_url) return [outfit.image_url];
                    const items = (outfit.clothing_items || []).filter((item: any) => item.image_url);
                    return items.map((item: any) => item.image_url);
                  };

                  let displayImages: string[][] = scheduledOutfits.map(co => getOutfitImages(co.outfit)).filter(imgs => imgs.length > 0);

                  // Take up to 4 outfit slots for the grid
                  const imagesToShow = displayImages.slice(0, 4);

                  const renderGridItem = (images: string[], style: any, index: number) => {
                    if (images.length === 0) return <View key={`empty-${index}`} style={[style, { backgroundColor: FuchsiaColors.mist }]} />;
                    if (images.length === 1) return <Image key={`img-${index}`} source={{ uri: images[0] }} style={style} contentFit="cover" />;
                    
                    // Mini grid
                    return (
                      <View key={`grid-${index}`} style={[style, styles.collageGrid]}>
                        {images.length === 2 && (
                          <>
                            <Image source={{ uri: images[0] }} style={styles.collageHalf} contentFit="cover" />
                            <Image source={{ uri: images[1] }} style={styles.collageHalf} contentFit="cover" />
                          </>
                        )}
                        {images.length >= 3 && (
                          <>
                            <Image source={{ uri: images[0] }} style={images.length === 3 ? styles.collageTopRowSpan : styles.collageQuarter} contentFit="cover" />
                            <Image source={{ uri: images[1] }} style={styles.collageQuarter} contentFit="cover" />
                            <Image source={{ uri: images[2] }} style={styles.collageQuarter} contentFit="cover" />
                            {images.length >= 4 && (
                              <Image source={{ uri: images[3] }} style={styles.collageQuarter} contentFit="cover" />
                            )}
                          </>
                        )}
                      </View>
                    );
                  };

                  return (
                    <Pressable
                      key={dateStr}
                      style={[styles.outfitCell, cellStyle, { marginBottom: 4 }]}
                      onPress={() => {
                        setSelectedDayStr(dateStr);
                        setIsDayModalVisible(true);
                      }}
                    >
                      {imagesToShow.length > 0 ? (
                        <View style={styles.collageGrid}>
                          {imagesToShow.length === 1 && (
                            renderGridItem(imagesToShow[0], styles.collageFull, 0)
                          )}
                          {imagesToShow.length === 2 && (
                            <>
                              {renderGridItem(imagesToShow[0], styles.collageHalf, 0)}
                              {renderGridItem(imagesToShow[1], styles.collageHalf, 1)}
                            </>
                          )}
                          {imagesToShow.length >= 3 && (
                            <>
                              {renderGridItem(imagesToShow[0], imagesToShow.length === 3 ? styles.collageTopRowSpan : styles.collageQuarter, 0)}
                              {renderGridItem(imagesToShow[1], styles.collageQuarter, 1)}
                              {renderGridItem(imagesToShow[2], styles.collageQuarter, 2)}
                              {imagesToShow.length >= 4 && (
                                renderGridItem(imagesToShow[3], styles.collageQuarter, 3)
                              )}
                            </>
                          )}
                        </View>
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.mist }]} />
                      )}
                      
                      <LinearGradient
                        colors={['rgba(0,0,0,0.4)', 'transparent']}
                        style={[StyleSheet.absoluteFillObject, { height: '50%' }]}
                      />
                      {isToday ? (
                        <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: FuchsiaColors.vibrant, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                          <Text style={{ fontFamily: FuchsiaFonts.body, fontSize: 10, fontWeight: '800', color: '#fff' }}>{dayNum}</Text>
                        </View>
                      ) : (
                        <Text style={styles.outfitCellDayNum}>{dayNum}</Text>
                      )}
                      
                      {scheduledOutfits.length > 4 && (
                        <View style={styles.moreBadge}>
                          <Text style={styles.moreBadgeText}>+{scheduledOutfits.length - 4}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                }

                if (isToday) {
                  return (
                    <View key={dateStr} style={[styles.todayCell, cellStyle, { marginBottom: 4 }]}>
                      <Text style={styles.todayCellNum}>{dayNum}</Text>
                      <Text style={styles.todayCellText}>TODAY</Text>
                    </View>
                  );
                }

                return (
                  <View key={dateStr} style={[styles.emptyDayCell, cellStyle, { marginBottom: 4 }]}>
                    <Text style={styles.emptyDayNum}>{dayNum}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Shirt size={14} color={FuchsiaColors.deep} />
              <ThemedText style={styles.statText}>{totalOutfitsThisMonth} outfits</ThemedText>
            </View>
            <ThemedText style={styles.statDot}>·</ThemedText>
            <View style={styles.statItem}>
              <Sparkles size={14} color={FuchsiaColors.deep} />
              <ThemedText style={styles.statText}>{aiPicksThisMonth} AI picks</ThemedText>
            </View>
          </View>

          {!todaysOutfit && (
            <View style={styles.todayPreviewCard}>
              <ThemedText style={styles.todayPreviewTitle}>NO OUTFIT LOGGED TODAY</ThemedText>
              <ThemedText style={styles.todayPreviewSubtitle}>
                Ask fuchsia for a recommendation or log what you're wearing.
              </ThemedText>
              <View style={styles.todayPreviewActions}>
                <Pressable style={styles.primaryAction} onPress={() => router.push('/')}>
                  <Text style={styles.primaryActionText}>Get Outfit</Text>
                </Pressable>
                <Pressable style={styles.secondaryAction} onPress={() => router.push('/add-outfit')}>
                  <Text style={styles.secondaryActionText}>Log Manually</Text>
                </Pressable>
              </View>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Month/Year Picker Modal */}
      <Modal visible={isPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setPickerYear(y => y - 1)} style={styles.navButton}>
                <ChevronLeft size={20} color={FuchsiaColors.ink} />
              </Pressable>
              <ThemedText style={styles.modalYearText}>{pickerYear}</ThemedText>
              <Pressable onPress={() => setPickerYear(y => y + 1)} style={styles.navButton}>
                <ChevronRight size={20} color={FuchsiaColors.ink} />
              </Pressable>
            </View>

            <View style={styles.monthsGrid}>
              {monthNames.map((mName, index) => {
                const isSelected = index === pickerMonth;
                return (
                  <Pressable
                    key={mName}
                    style={[styles.monthPill, isSelected && styles.monthPillSelected]}
                    onPress={() => setPickerMonth(index)}
                  >
                    <Text style={[styles.monthPillText, isSelected && styles.monthPillTextSelected]}>
                      {mName.substring(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setIsPickerVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={styles.modalApplyButton} 
                onPress={() => {
                  setCurrentMonth(new Date(pickerYear, pickerMonth, 1));
                  setIsPickerVisible(false);
                }}
              >
                <Text style={styles.modalApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Day Detail Modal */}
      <Modal visible={isDayModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.dayModalContent}>
            <View style={styles.dayModalHeader}>
              <ThemedText style={styles.dayModalTitle}>
                {selectedDayStr ? new Date(selectedDayStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''}
              </ThemedText>
              <Pressable onPress={() => setIsDayModalVisible(false)} style={styles.closeModalButton}>
                <X size={20} color={FuchsiaColors.slate} />
              </Pressable>
            </View>

            <ScrollView style={styles.dayModalList}>
              {(selectedDayStr ? outfitsByDate[selectedDayStr] || [] : []).map(calendarOutfit => {
                const outfit = calendarOutfit.outfit;
                const items = (outfit.clothing_items || []).filter(item => item.image_url);
                const firstUploadedImage = outfit.images && outfit.images.length > 0 ? outfit.images[0].image_url : null;
                const displayImage = firstUploadedImage || outfit.image_url;
                const isPast = selectedDayStr ? selectedDayStr < todayStr : false;
                
                return (
                  <View key={calendarOutfit.id} style={styles.dayModalOutfitRow}>
                    <Pressable 
                      style={styles.dayModalOutfitImage}
                      onPress={() => {
                        setIsDayModalVisible(false);
                        router.push(`/outfit/${outfit.id}`);
                      }}
                    >
                      {displayImage ? (
                        <Image source={{ uri: displayImage }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                      ) : items.length > 0 ? (
                        <View style={styles.collageGrid}>
                          {items.length === 1 && (
                            <Image source={{ uri: items[0].image_url as string }} style={styles.collageFull} contentFit="cover" />
                          )}
                          {items.length === 2 && (
                            <>
                              <Image source={{ uri: items[0].image_url as string }} style={styles.collageHalf} contentFit="cover" />
                              <Image source={{ uri: items[1].image_url as string }} style={styles.collageHalf} contentFit="cover" />
                            </>
                          )}
                          {items.length >= 3 && (
                            <>
                              <Image source={{ uri: items[0].image_url as string }} style={items.length === 3 ? styles.collageTopRowSpan : styles.collageQuarter} contentFit="cover" />
                              <Image source={{ uri: items[1].image_url as string }} style={styles.collageQuarter} contentFit="cover" />
                              <Image source={{ uri: items[2].image_url as string }} style={styles.collageQuarter} contentFit="cover" />
                              {items.length >= 4 && (
                                <Image source={{ uri: items[3].image_url as string }} style={styles.collageQuarter} contentFit="cover" />
                              )}
                            </>
                          )}
                        </View>
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.mist }]} />
                      )}
                    </Pressable>
                    <View style={styles.dayModalOutfitInfo}>
                      <Text style={styles.dayModalOutfitName} numberOfLines={1}>{outfit.name}</Text>
                      <Text style={styles.dayModalOutfitSubtitle} numberOfLines={1}>
                        {outfit.clothing_items_count} {outfit.clothing_items_count === 1 ? 'item' : 'items'}
                        {outfit.is_ai_generated ? ' • AI Pick' : ''}
                      </Text>
                    </View>
                    <View style={styles.dayModalOutfitActions}>
                      {!isPast && (
                        <Pressable 
                          style={styles.dayModalIconButton}
                          onPress={() => {
                            setRescheduleOutfitId(calendarOutfit.id);
                            setShowReschedulePicker(true);
                          }}
                        >
                          <Calendar size={18} color={FuchsiaColors.deep} />
                        </Pressable>
                      )}
                      <Pressable 
                        style={[styles.dayModalIconButton, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => handleRemove(calendarOutfit.id)}
                      >
                        <Trash2 size={18} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reschedule Date Picker */}
      <CustomDatePicker
        visible={showReschedulePicker}
        value={selectedDayStr ? new Date(selectedDayStr + 'T12:00:00Z') : new Date()}
        onClose={() => setShowReschedulePicker(false)}
        onChange={handleRescheduleDateChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 24,
    color: FuchsiaColors.ink,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  monthText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    color: FuchsiaColors.ink,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  gridContainer: {
    marginBottom: 16,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayLabel: {
    textAlign: 'center',
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: FuchsiaColors.slate,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyDayCell: {
    backgroundColor: 'rgba(248, 248, 252, 0.3)', // FuchsiaColors.cloud with opacity
    borderRadius: 12,
    position: 'relative',
  },
  emptyDayNum: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(74, 74, 104, 0.6)', // FuchsiaColors.slate with opacity
  },
  outfitCell: {
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  outfitCellGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  outfitCellDayNum: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    zIndex: 10,
  },
  moreBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 20, 90, 0.9)', // FuchsiaColors.vibrant
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  moreBadgeText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  todayCell: {
    borderRadius: 12,
    backgroundColor: FuchsiaColors.vibrant,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: FuchsiaColors.deep,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  todayCellNum: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  todayCellText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: FuchsiaColors.blush,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: FuchsiaColors.deep,
  },
  statDot: {
    color: FuchsiaColors.mist,
    fontSize: 14,
  },
  todayPreviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    padding: 16,
  },
  todayPreviewTitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: FuchsiaColors.slate,
    marginBottom: 8,
  },
  todayPreviewSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.ink,
    marginBottom: 12,
  },
  todayPreviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryAction: {
    backgroundColor: FuchsiaColors.deep,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryAction: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  collageGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: FuchsiaColors.mist,
  },
  collageFull: {
    width: '100%',
    height: '100%',
  },
  collageHalf: {
    width: '50%',
    height: '100%',
    borderWidth: 0.5,
    borderColor: FuchsiaColors.mist,
  },
  collageTopRowSpan: {
    width: '100%',
    height: '50%',
    borderWidth: 0.5,
    borderColor: FuchsiaColors.mist,
  },
  collageQuarter: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    borderColor: FuchsiaColors.mist,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  dayModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  dayModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dayModalTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    color: FuchsiaColors.ink,
  },
  closeModalButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: FuchsiaColors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayModalList: {
    width: '100%',
  },
  dayModalOutfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
  },
  dayModalOutfitImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
  },
  dayModalOutfitInfo: {
    flex: 1,
  },
  dayModalOutfitName: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  dayModalOutfitSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.slate,
  },
  dayModalOutfitActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dayModalIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: FuchsiaColors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalYearText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    color: FuchsiaColors.ink,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 32,
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
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: FuchsiaColors.cloud,
  },
  modalCancelText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  modalApplyButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: FuchsiaColors.ink,
  },
  modalApplyText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
