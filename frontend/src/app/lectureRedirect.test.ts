import { describe, expect, it } from 'vitest';
import { lectureRedirect } from './lectureRedirect';
import { LESSONS } from '../features/lecture/lessons';
import { LESSON_GUIDES } from '../features/lecture/lessonGuides';

describe('public lecture navigation', () => {
  it('maps old bookmarks without enabling a backup interface', () => {
    expect(lectureRedirect('/PLAYGROUND/LEARN/EUCLID/')).toBe('/lecture/inverse');
    expect(lectureRedirect('/learn/encrypt')).toBe('/lecture/messages');
    expect(lectureRedirect('/playground/legacy')).toBe('/');
    expect(lectureRedirect('/legacy/anything')).toBe('/');
    expect(lectureRedirect('/playground/not-a-lesson')).toBe('/');
    expect(lectureRedirect('/unknown')).toBeNull();
    expect(lectureRedirect('/account')).toBeNull();
    expect(lectureRedirect('/privacy')).toBeNull();
    expect(lectureRedirect('/lecture/gcd')).toBeNull();
  });
  it('gives every public lesson a distinct introduction and a usable tour', () => {
    expect(Object.keys(LESSON_GUIDES).sort()).toEqual(LESSONS.map((lesson) => lesson.path).sort());
    expect(new Set(Object.values(LESSON_GUIDES).map((guide) => guide.purpose)).size).toBe(
      LESSONS.length,
    );
    for (const guide of Object.values(LESSON_GUIDES)) {
      expect(guide.takeaway.length).toBeGreaterThan(30);
      expect(guide.steps.length).toBeGreaterThanOrEqual(4);
      for (const step of guide.steps) expect(step.target.length).toBeGreaterThan(0);
    }
  });
});
