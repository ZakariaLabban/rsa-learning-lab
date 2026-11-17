import { createContext, useContext, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import type { LearningMode } from '../workshop/model';

type Experience = {
  modern: boolean;
  enabled: boolean;
  mode: LearningMode;
  setMode: (mode: LearningMode) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  reduced: boolean;
  toggleMotion: () => void;
};
const LessonExperience = createContext<Experience>({
  modern: false,
  enabled: false,
  mode: 'guided',
  setMode: () => {},
  speed: 1,
  setSpeed: () => {},
  reduced: false,
  toggleMotion: () => {},
});
export function LessonExperienceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LearningMode>('guided'),
    [speed, setSpeed] = useState(1);
  const system = useReducedMotion(),
    [choice, setChoice] = useState<boolean | null>(null);
  const reduced = choice ?? Boolean(system);
  return (
    <LessonExperience.Provider
      value={{
        modern: true,
        enabled: true,
        mode,
        setMode,
        speed,
        setSpeed,
        reduced,
        toggleMotion: () => setChoice(!reduced),
      }}
    >
      {children}
    </LessonExperience.Provider>
  );
}
export const useLessonExperience = () => useContext(LessonExperience);

export function LessonVisibility({ visible, children }: { visible: boolean; children: ReactNode }) {
  const context = useLessonExperience();
  return (
    <LessonExperience.Provider value={{ ...context, enabled: context.enabled && visible }}>
      {children}
    </LessonExperience.Provider>
  );
}
