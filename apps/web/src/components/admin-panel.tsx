"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HERO_CATALOG, type Hero, type HeroRole } from "@/data/heroes";
import type { Role } from "@teamcomposer/optimizer";

const ROLES: HeroRole[] = ["Vanguard", "Duelist", "Strategist"];
const ARCHETYPES = ["Generalist", "Hybrid", "Specialist"] as const;
const JOBS = ["Dive", "Brawl", "Peel", "Poke", "Control", "Shield", "Heal"] as const;

interface OverrideFormState {
  role: "" | Role;
  archetype: string;
  primaryJob: string;
  secondaryJob: string;
  healingPriority: string;
  counters: string;
  counteredBy: string;
  synergies: string;
}

interface HeroIdMultiSelectProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  catalog: readonly Hero[];
}

function HeroIdMultiSelect({ label, value, onChange, catalog }: HeroIdMultiSelectProps) {
  const selectedIds = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const selected = new Set(selectedIds);

  const addHero = (id: string) => {
    if (selected.has(id)) return;
    onChange([...selectedIds, id].join(", "));
  };

  const removeHero = (id: string) => {
    onChange(selectedIds.filter((v) => v !== id).join(", "));
  };

  return (
    <div className="sm:col-span-2 lg:col-span-4">
      <label className="text-xs text-zinc-600 dark:text-zinc-300">{label}</label>
      <select
        defaultValue=""
        onChange={(e) => {
          if (!e.target.value) return;
          addHero(e.target.value);
          e.currentTarget.value = "";
        }}
        className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <option value="">Add hero...</option>
        {catalog.filter((hero) => !selected.has(hero.id)).map((hero) => (
          <option key={hero.id} value={hero.id}>
            {hero.name} ({hero.id})
          </option>
        ))}
      </select>

      {selectedIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const hero = catalog.find((h) => h.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => removeHero(id)}
                className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                title="Remove"
              >
                {hero?.name ?? id} ×
              </button>
            );
          })}
        </div>
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        placeholder="comma-separated hero ids"
      />
    </div>
  );
}

export function AdminPanel() {
  const [heroCatalog, setHeroCatalog] = useState<readonly Hero[]>(() => [...HERO_CATALOG]);
  const [catalogExtras, setCatalogExtras] = useState<Hero[]>([]);
  const [newHeroId, setNewHeroId] = useState("");
  const [newHeroName, setNewHeroName] = useState("");
  const [newHeroRole, setNewHeroRole] = useState<HeroRole>("Duelist");
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [overrideEditor, setOverrideEditor] = useState("{}");
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  const [extrasStatus, setExtrasStatus] = useState<string | null>(null);
  const [selectedOverrideHeroId, setSelectedOverrideHeroId] = useState(
    HERO_CATALOG[0]?.id ?? "",
  );
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    role: "",
    archetype: "",
    primaryJob: "",
    secondaryJob: "",
    healingPriority: "",
    counters: "",
    counteredBy: "",
    synergies: "",
  });

  const adminFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, credentials: "include" }),
    [],
  );

  const refreshHeroes = useCallback(async () => {
    const res = await fetch("/api/heroes");
    const json = (await res.json()) as { ok?: boolean; heroes?: Hero[] };
    if (res.ok && json.ok && Array.isArray(json.heroes)) {
      setHeroCatalog(json.heroes);
    }
  }, []);

  useEffect(() => {
    void refreshHeroes();
  }, [refreshHeroes]);

  const loadExtras = useCallback(async () => {
    setLoadingExtras(true);
    setExtrasStatus(null);
    try {
      const response = await adminFetch("/api/admin/catalog-extras");
      const json = (await response.json()) as { ok: boolean; extras?: Hero[]; error?: string };
      if (!response.ok || !json.ok) {
        setExtrasStatus(json.error ?? "Failed to load catalog extras");
        return;
      }
      setCatalogExtras(Array.isArray(json.extras) ? json.extras : []);
      setExtrasStatus("Loaded extra heroes.");
    } catch {
      setExtrasStatus("Failed to load catalog extras");
    } finally {
      setLoadingExtras(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  const saveExtras = async () => {
    setLoadingExtras(true);
    setExtrasStatus(null);
    try {
      const response = await adminFetch("/api/admin/catalog-extras", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extras: catalogExtras }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setExtrasStatus(json.error ?? "Failed to save");
        return;
      }
      setExtrasStatus("Saved extra heroes. They appear on the main app after refresh.");
      await refreshHeroes();
    } catch {
      setExtrasStatus("Failed to save");
    } finally {
      setLoadingExtras(false);
    }
  };

  const addExtraHero = () => {
    const id = newHeroId.trim().toLowerCase();
    const name = newHeroName.trim();
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
      setExtrasStatus("Id must be a slug: lowercase letters, numbers, hyphens.");
      return;
    }
    if (!name) {
      setExtrasStatus("Name is required.");
      return;
    }
    if (HERO_CATALOG.some((h) => h.id === id)) {
      setExtrasStatus("That id is already a built-in hero.");
      return;
    }
    if (catalogExtras.some((h) => h.id === id)) {
      setExtrasStatus("That id is already in the extra list.");
      return;
    }
    setCatalogExtras((prev) => [...prev, { id, name, role: newHeroRole }]);
    setNewHeroId("");
    setNewHeroName("");
    setExtrasStatus("Added locally — click Save extra heroes to persist.");
  };

  const removeExtraHero = (id: string) => {
    setCatalogExtras((prev) => prev.filter((h) => h.id !== id));
    setExtrasStatus("Removed locally — click Save extra heroes to persist.");
  };

  const loadOverrides = async () => {
    setLoadingOverrides(true);
    setOverrideStatus(null);
    try {
      const response = await adminFetch("/api/admin/hero-data");
      const json = (await response.json()) as {
        ok: boolean;
        error?: string;
        heroOverrides?: Record<string, unknown>;
      };
      if (!response.ok || !json.ok) {
        setOverrideStatus(json.error ?? "Failed to load overrides");
        return;
      }
      setOverrideEditor(JSON.stringify(json.heroOverrides ?? {}, null, 2));
      setOverrideStatus("Loaded overrides from database.");
    } catch {
      setOverrideStatus("Failed to load overrides");
    } finally {
      setLoadingOverrides(false);
    }
  };

  const parseOverrideEditor = useCallback((): Record<string, unknown> | null => {
    try {
      return JSON.parse(overrideEditor) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [overrideEditor]);

  const syncFormFromEditor = useCallback(() => {
    const parsed = parseOverrideEditor();
    if (!parsed) {
      setOverrideStatus("Invalid JSON in override editor.");
      return;
    }
    const raw = parsed[selectedOverrideHeroId];
    const heroOverride =
      typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const toList = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string").join(", ")
        : "";

    setOverrideForm({
      role:
        heroOverride.role === "Vanguard" ||
        heroOverride.role === "Duelist" ||
        heroOverride.role === "Strategist"
          ? (heroOverride.role as Role)
          : "",
      archetype: typeof heroOverride.archetype === "string" ? heroOverride.archetype : "",
      primaryJob:
        typeof heroOverride.primaryJob === "string" ? heroOverride.primaryJob : "",
      secondaryJob:
        typeof heroOverride.secondaryJob === "string" ? heroOverride.secondaryJob : "",
      healingPriority:
        typeof heroOverride.healingPriority === "number"
          ? String(heroOverride.healingPriority)
          : "",
      counters: toList(heroOverride.counters),
      counteredBy: toList(heroOverride.counteredBy),
      synergies: toList(heroOverride.synergies),
    });
    setOverrideStatus(null);
  }, [parseOverrideEditor, selectedOverrideHeroId]);

  const applyFormToEditor = () => {
    const parsed = parseOverrideEditor();
    if (!parsed) {
      setOverrideStatus("Invalid JSON in override editor.");
      return;
    }
    const splitList = (value: string) =>
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    const next: Record<string, unknown> = { ...parsed };
    const heroPatch: Record<string, unknown> = {};
    if (overrideForm.role) heroPatch.role = overrideForm.role;
    if (overrideForm.archetype) heroPatch.archetype = overrideForm.archetype;
    if (overrideForm.primaryJob) heroPatch.primaryJob = overrideForm.primaryJob;
    if (overrideForm.secondaryJob) heroPatch.secondaryJob = overrideForm.secondaryJob;
    if (overrideForm.healingPriority) {
      const n = Number(overrideForm.healingPriority);
      if (!Number.isNaN(n)) heroPatch.healingPriority = n;
    }
    if (overrideForm.counters.trim()) heroPatch.counters = splitList(overrideForm.counters);
    if (overrideForm.counteredBy.trim()) {
      heroPatch.counteredBy = splitList(overrideForm.counteredBy);
    }
    if (overrideForm.synergies.trim()) heroPatch.synergies = splitList(overrideForm.synergies);

    next[selectedOverrideHeroId] = heroPatch;
    setOverrideEditor(JSON.stringify(next, null, 2));
    setOverrideStatus(`Applied form changes for ${selectedOverrideHeroId}.`);
  };

  const removeHeroOverride = () => {
    const parsed = parseOverrideEditor();
    if (!parsed) {
      setOverrideStatus("Invalid JSON in override editor.");
      return;
    }
    const next = { ...parsed };
    delete next[selectedOverrideHeroId];
    setOverrideEditor(JSON.stringify(next, null, 2));
    setOverrideStatus(`Removed override for ${selectedOverrideHeroId}.`);
  };

  const saveOverrides = async () => {
    setLoadingOverrides(true);
    setOverrideStatus(null);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(overrideEditor) as Record<string, unknown>;
      } catch {
        setOverrideStatus("Invalid JSON in override editor.");
        return;
      }

      const response = await adminFetch("/api/admin/hero-data", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heroOverrides: parsed }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setOverrideStatus(json.error ?? "Failed to save overrides");
        return;
      }
      setOverrideStatus("Saved overrides.");
    } catch {
      setOverrideStatus("Failed to save overrides");
    } finally {
      setLoadingOverrides(false);
    }
  };

  const logout = async () => {
    await adminFetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
            Admin
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Hero data & roster</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            This area is not linked from the public composer. Use{" "}
            <Link href="/" className="text-red-600 underline dark:text-red-400">
              Home
            </Link>{" "}
            for the main tool.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          Sign out
        </button>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h2 className="text-base font-semibold">Extra heroes (custom roster)</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add heroes not in the shipped catalog. They appear in the main app pool and need a{" "}
          <strong className="font-medium">role</strong> for scoring (saved with the entry). Add
          guide overrides below for jobs, counters, and synergies.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-600 dark:text-zinc-300">
            Id (slug)
            <input
              value={newHeroId}
              onChange={(e) => setNewHeroId(e.target.value)}
              className="mt-1 block w-44 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="e.g. squirrel-girl"
            />
          </label>
          <label className="text-xs text-zinc-600 dark:text-zinc-300">
            Display name
            <input
              value={newHeroName}
              onChange={(e) => setNewHeroName(e.target.value)}
              className="mt-1 block w-48 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Squirrel Girl"
            />
          </label>
          <label className="text-xs text-zinc-600 dark:text-zinc-300">
            Role
            <select
              value={newHeroRole}
              onChange={(e) => setNewHeroRole(e.target.value as HeroRole)}
              className="mt-1 block rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addExtraHero}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
          >
            Add to list
          </button>
          <button
            type="button"
            onClick={() => void loadExtras()}
            disabled={loadingExtras}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Reload from DB
          </button>
          <button
            type="button"
            onClick={() => void saveExtras()}
            disabled={loadingExtras}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Save extra heroes
          </button>
        </div>

        {catalogExtras.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
            {catalogExtras.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{h.name}</span>{" "}
                  <code className="text-xs text-zinc-500">{h.id}</code> · {h.role}
                </span>
                <button
                  type="button"
                  onClick={() => removeExtraHero(h.id)}
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {extrasStatus && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{extrasStatus}</p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h2 className="text-base font-semibold">Hero guide overrides</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Persist scoring tweaks (jobs, priorities, counters, synergies) to Postgres.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadOverrides()}
            disabled={loadingOverrides}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            Load
          </button>
          <button
            type="button"
            onClick={() => void saveOverrides()}
            disabled={loadingOverrides}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>

        <textarea
          value={overrideEditor}
          onChange={(e) => setOverrideEditor(e.target.value)}
          className="mt-3 h-44 w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
          spellCheck={false}
        />
        <div className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Schema-aware form editor</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Edit one hero override without writing JSON manually.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Hero
              <select
                value={selectedOverrideHeroId}
                onChange={(e) => setSelectedOverrideHeroId(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {heroCatalog.map((hero) => (
                  <option key={hero.id} value={hero.id}>
                    {hero.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Role
              <select
                value={overrideForm.role}
                onChange={(e) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    role: (e.target.value as Role | "") ?? "",
                  }))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">(no override)</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Archetype
              <select
                value={overrideForm.archetype}
                onChange={(e) =>
                  setOverrideForm((prev) => ({ ...prev, archetype: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">(no override)</option>
                {ARCHETYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Healing priority
              <input
                type="number"
                min={0}
                max={5}
                value={overrideForm.healingPriority}
                onChange={(e) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    healingPriority: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Primary job
              <select
                value={overrideForm.primaryJob}
                onChange={(e) =>
                  setOverrideForm((prev) => ({ ...prev, primaryJob: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">(no override)</option>
                {JOBS.map((job) => (
                  <option key={job} value={job}>
                    {job}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Secondary job
              <select
                value={overrideForm.secondaryJob}
                onChange={(e) =>
                  setOverrideForm((prev) => ({ ...prev, secondaryJob: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">(no override)</option>
                {JOBS.map((job) => (
                  <option key={job} value={job}>
                    {job}
                  </option>
                ))}
              </select>
            </label>
            <HeroIdMultiSelect
              label="Counters"
              value={overrideForm.counters}
              onChange={(next) =>
                setOverrideForm((prev) => ({
                  ...prev,
                  counters: next,
                }))
              }
              catalog={heroCatalog}
            />
            <HeroIdMultiSelect
              label="Countered by"
              value={overrideForm.counteredBy}
              onChange={(next) =>
                setOverrideForm((prev) => ({
                  ...prev,
                  counteredBy: next,
                }))
              }
              catalog={heroCatalog}
            />
            <HeroIdMultiSelect
              label="Synergies"
              value={overrideForm.synergies}
              onChange={(next) =>
                setOverrideForm((prev) => ({
                  ...prev,
                  synergies: next,
                }))
              }
              catalog={heroCatalog}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={syncFormFromEditor}
              className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
            >
              Load hero into form
            </button>
            <button
              type="button"
              onClick={applyFormToEditor}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              Apply form to JSON
            </button>
            <button
              type="button"
              onClick={removeHeroOverride}
              className="rounded-md border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-300"
            >
              Remove hero override
            </button>
          </div>
        </div>
        {overrideStatus && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{overrideStatus}</p>
        )}
      </section>
    </div>
  );
}
