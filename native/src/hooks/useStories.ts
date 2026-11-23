import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { getUserUnitSlugs, isTargetForUser } from '../../app/(tabs)/index';

const SEEN_STORIES_KEY = '@kihap:seen_stories_v1';

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  isHighlight?: boolean;
  highlightTitle?: string;
  stories: any[];
}

function getCreatedAtMs(story: any): number {
  const c = story?.createdAt;
  if (!c) return 0;
  if (typeof c.toMillis === 'function') return c.toMillis();
  if (c.seconds) return c.seconds * 1000;
  const parsed = new Date(c).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getExpiresAtMs(story: any): number {
  const e = story?.expiresAt;
  if (!e) return 0;
  if (typeof e.toMillis === 'function') return e.toMillis();
  if (e.seconds) return e.seconds * 1000;
  const parsed = new Date(e).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dedupeAndFilterStories(
  rawStories: any[],
  userUid: string,
  userUnitSlugs: string[]
): any[] {
  const batchUnitsMap = new Map<string, Set<string>>();

  rawStories.forEach((story) => {
    if (story.batchId && story.targetUnit) {
      if (!batchUnitsMap.has(story.batchId)) {
        batchUnitsMap.set(story.batchId, new Set<string>());
      }
      batchUnitsMap.get(story.batchId)!.add(story.targetUnit);
    }
  });

  const result: any[] = [];
  const seenBatches = new Set<string>();
  const seenDocIds = new Set<string>();

  rawStories.forEach((story) => {
    if (seenDocIds.has(story.id)) return;
    seenDocIds.add(story.id);

    // Moderação pronta para o futuro quando alunos puderem enviar stories
    if (story.moderationStatus === 'rejected' || story.moderationStatus === 'pending') {
      return;
    }

    if (story.batchId && batchUnitsMap.has(story.batchId)) {
      const batchUnits = Array.from(batchUnitsMap.get(story.batchId)!);
      if (!story.targetUnits || story.targetUnits.length === 0) {
        story.targetUnits = batchUnits;
      }
    }

    if (story.batchId) {
      if (seenBatches.has(story.batchId)) return;
      seenBatches.add(story.batchId);
    }

    const isAuthor = story.authorId === userUid;
    const isTargeted = isTargetForUser(story, userUid, userUnitSlugs);
    if (isAuthor || isTargeted) {
      result.push(story);
    }
  });

  return result;
}

export function useStories() {
  const { user, userData } = useAuth();
  const [activeStoriesRaw, setActiveStoriesRaw] = useState<any[]>([]);
  const [highlightStoriesRaw, setHighlightStoriesRaw] = useState<any[]>([]);
  const [seenStoryIds, setSeenStoryIds] = useState<Set<string>>(new Set());
  const [allowStudentStories, setAllowStudentStories] = useState(false);

  // Carrega histórico local de stories visualizados
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(SEEN_STORIES_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSeenStoryIds(new Set(parsed.map(String)));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Config social para futuro suporte a stories de alunos
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'config', 'social_settings'),
      (snap) => {
        if (snap.exists()) {
          setAllowStudentStories(Boolean(snap.data()?.allowStudentStories));
        } else {
          setAllowStudentStories(false);
        }
      },
      () => setAllowStudentStories(false)
    );
    return () => unsub();
  }, [user?.uid]);

  // Escuta stories ativos (24h) + Destaques (Highlights)
  useEffect(() => {
    if (!user) {
      setActiveStoriesRaw([]);
      setHighlightStoriesRaw([]);
      return;
    }

    const now = new Date();
    const activeQ = query(
      collection(db, 'stories'),
      where('expiresAt', '>=', now),
      orderBy('expiresAt', 'asc')
    );

    const highlightsQ = query(
      collection(db, 'stories'),
      where('isHighlight', '==', true)
    );

    const unsubActive = onSnapshot(
      activeQ,
      (snap) => {
        const currentMs = Date.now();
        const list: any[] = [];
        snap.forEach((d) => {
          const item = { id: d.id, ...d.data() };
          const expMs = getExpiresAtMs(item);
          if (expMs && expMs < currentMs) return;
          list.push(item);
        });
        setActiveStoriesRaw(list);
      },
      (err) => console.error('[useStories] Active snapshot error:', err)
    );

    const unsubHighlights = onSnapshot(
      highlightsQ,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setHighlightStoriesRaw(list);
      },
      (err) => console.error('[useStories] Highlights snapshot error:', err)
    );

    return () => {
      unsubActive();
      unsubHighlights();
    };
  }, [user?.uid]);

  const markStorySeen = useCallback(
    async (storyId: string) => {
      if (!storyId) return;

      setSeenStoryIds((prev) => {
        if (prev.has(storyId)) return prev;
        const next = new Set(prev);
        next.add(storyId);
        const arr = Array.from(next).slice(-300);
        AsyncStorage.setItem(SEEN_STORIES_KEY, JSON.stringify(arr)).catch(() => {});
        return next;
      });

      if (user?.uid) {
        updateDoc(doc(db, 'stories', storyId), {
          viewers: arrayUnion(user.uid),
        }).catch(() => {});
      }
    },
    [user?.uid]
  );

  const { groups, highlights } = useMemo(() => {
    if (!user?.uid) return { groups: [] as StoryGroup[], highlights: [] as StoryGroup[] };

    const userUnitSlugs = getUserUnitSlugs(userData);

    const filteredActive = dedupeAndFilterStories(
      activeStoriesRaw.filter((s) => !s.isHighlight),
      user.uid,
      userUnitSlugs
    );

    const filteredHighlights = dedupeAndFilterStories(
      highlightStoriesRaw,
      user.uid,
      userUnitSlugs
    );

    // Agrupa stories ativos por autor e ordena não vistos primeiro
    const groupedMap: Record<string, StoryGroup> = {};
    filteredActive.forEach((story) => {
      const aId = story.authorId || 'kihap';
      if (!groupedMap[aId]) {
        groupedMap[aId] = {
          authorId: aId,
          authorName: story.authorName || 'Kihap',
          authorPhotoURL: story.authorPhotoURL,
          isHighlight: false,
          stories: [],
        };
      }
      groupedMap[aId].stories.push(story);
    });

    const groupsList = Object.values(groupedMap).map((g) => ({
      ...g,
      stories: [...g.stories].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b)),
    }));

    groupsList.sort((a, b) => {
      const aUnseen = a.stories.some((s) => !seenStoryIds.has(s.id));
      const bUnseen = b.stories.some((s) => !seenStoryIds.has(s.id));
      if (aUnseen !== bUnseen) return aUnseen ? -1 : 1;
      const aLast = getCreatedAtMs(a.stories[a.stories.length - 1]);
      const bLast = getCreatedAtMs(b.stories[b.stories.length - 1]);
      return bLast - aLast;
    });

    // Agrupa Destaques (Highlights) por highlightTitle
    const highlightsMap: Record<string, StoryGroup> = {};
    filteredHighlights.forEach((story) => {
      const hTitle = (story.highlightTitle || 'Destaques Kihap').trim();
      const key = `highlight_${hTitle.toLowerCase().replace(/\s+/g, '_')}`;
      if (!highlightsMap[key]) {
        highlightsMap[key] = {
          authorId: key,
          authorName: hTitle,
          highlightTitle: hTitle,
          authorPhotoURL: story.authorPhotoURL || story.mediaUrl,
          isHighlight: true,
          stories: [],
        };
      }
      highlightsMap[key].stories.push(story);
    });

    const highlightsList = Object.values(highlightsMap).map((h) => ({
      ...h,
      stories: [...h.stories].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b)),
    }));

    return { groups: groupsList, highlights: highlightsList };
  }, [user?.uid, userData, activeStoriesRaw, highlightStoriesRaw, seenStoryIds]);

  return {
    groups,
    highlights,
    seenStoryIds,
    markStorySeen,
    allowStudentStories,
  };
}
