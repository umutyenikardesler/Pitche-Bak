import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import PitchForm, { toPitchInput, type PitchFormValues } from '@/components/pitches/PitchForm';
import { createPitch, findNearbyPitches } from '@/services/pitches';

type Props = {
  /** Eklemeden sonra öneri listesini tazelemek gibi işler için. */
  onAdded?: () => void;
};

export default function AddPitchPanel({ onAdded }: Props) {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  // Başarılı eklemeden sonra formu boşaltmak için: yeniden monte ediyoruz.
  const [formKey, setFormKey] = useState(0);

  const save = async (values: PitchFormValues) => {
    setSubmitting(true);
    try {
      const input = toPitchInput(values);
      const { id, error } = await createPitch(input);
      if (error) {
        Alert.alert(t('admin.pitches.failedTitle'), error.message);
        return;
      }
      Alert.alert(t('admin.pitches.addedTitle'), t('admin.pitches.addedBody'));
      setFormKey((k) => k + 1);
      if (id != null) onAdded?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (values: PitchFormValues) => {
    // Aynı sahanın ikinci kez eklenmesi, maçların iki ayrı kayda dağılması demek.
    const nearby = await findNearbyPitches(values.latitude as number, values.longitude as number);
    if (nearby.length > 0) {
      Alert.alert(
        t('admin.pitches.duplicateTitle'),
        t('admin.pitches.duplicateBody') + '\n\n' + nearby.map((p) => '• ' + p.name).join('\n'),
        [
          { text: t('general.cancel'), style: 'cancel' },
          { text: t('admin.pitches.addAnyway'), onPress: () => save(values) },
        ]
      );
      return;
    }
    await save(values);
  };

  return (
    <View>
      <PitchForm
        key={formKey}
        variant="admin"
        submitting={submitting}
        submitLabel={t('admin.pitches.submit')}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
