import type { BanSuggestion, DraftPickSuggestion, ScoredTeam } from "@teamcomposer/optimizer";
import { create } from "zustand";

interface ComposerState {
  selectedMapId: string;
  requestStatus: string | null;
  results: readonly ScoredTeam[] | null;
  draftPicks: readonly DraftPickSuggestion[] | null;
  banSuggestions: readonly BanSuggestion[];
  setSelectedMapId: (value: string) => void;
  setRequestStatus: (value: string | null) => void;
  setResults: (value: readonly ScoredTeam[] | null) => void;
  setDraftPicks: (value: readonly DraftPickSuggestion[] | null) => void;
  setBanSuggestions: (value: readonly BanSuggestion[]) => void;
  clearComputed: () => void;
}

const DEFAULT_MAP_ID = "empire-of-eternal-night-midtown";

export const useComposerStore = create<ComposerState>((set) => ({
  selectedMapId: DEFAULT_MAP_ID,
  requestStatus: null,
  results: null,
  draftPicks: null,
  banSuggestions: [],
  setSelectedMapId: (value) => set({ selectedMapId: value }),
  setRequestStatus: (value) => set({ requestStatus: value }),
  setResults: (value) => set({ results: value }),
  setDraftPicks: (value) => set({ draftPicks: value }),
  setBanSuggestions: (value) => set({ banSuggestions: value }),
  clearComputed: () => set({ requestStatus: null, results: null, draftPicks: null, banSuggestions: [] }),
}));
