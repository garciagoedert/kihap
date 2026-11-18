import React from 'react';
import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { KIHAP_UNITS } from '../utils/intranetPermissions';

interface UnitFilterStripProps {
  selectedUnit: string;
  onSelectUnit: (unitId: string) => void;
  includeAll?: boolean;
  allLabel?: string;
}

export function UnitFilterStrip({
  selectedUnit,
  onSelectUnit,
  includeAll = true,
  allLabel = 'Todas',
}: UnitFilterStripProps) {
  const options = includeAll
    ? [{ id: 'all', name: allLabel }, ...KIHAP_UNITS]
    : KIHAP_UNITS;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="py-2"
    >
      {options.map((unit) => {
        const isActive = selectedUnit === unit.id;
        return (
          <TouchableOpacity
            key={unit.id}
            onPress={() => onSelectUnit(unit.id)}
            activeOpacity={0.8}
            className={`px-3.5 py-2 rounded-xl border ${
              isActive
                ? 'bg-[#eab308] border-[#eab308]'
                : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                isActive ? 'text-black' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {unit.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
