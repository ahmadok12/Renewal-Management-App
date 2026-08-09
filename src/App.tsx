"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BadgeCheck,
  Bell,
  CalendarCheck,
  CalendarDays,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Globe2,
  GraduationCap,
  HeartPulse,
  House,
  KeyRound,
  Laptop,
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  PieChart,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  Shapes,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { auth, renewalStore } from "./supabase";
import "./styles.css";

type View = "today" | "items" | "calendar" | "family" | "settings";
type Category = "Documents" | "Cards" | "Subscriptions" | "Memberships" | "Vehicle" | "Insurance" | "Warranty" | "Utilities" | "Software" | "Domains" | "Licenses" | "Taxes" | "Property" | "Healthcare" | "Education" | "Other";
type RenewalRule = "ask" | "fixed" | "actual";
type ReminderMode = "relative" | "manual" | "date";
type Reminder = { mode: ReminderMode; months?: number; days?: number; date?: string };

type RenewalItem = {
  id: string;
  name: string;
  category: Category;
  dueDate: string;
  startDate?: string;
  amount?: number;
  currency: "PKR" | "USD";
  recurring: boolean;
  frequency: string;
  reminderDays: number[];
  reminders?: Reminder[] | null;
  person: string;
  notes?: string;
  renewalRule: RenewalRule;
  accent: string;
};

const today = new Date();

const categoryAccent: Record<Category, string> = {
  Documents: "amber", Cards: "mint", Subscriptions: "coral", Memberships: "violet",
  Vehicle: "blue", Insurance: "red", Warranty: "teal", Utilities: "gold",
  Software: "indigo", Domains: "sky", Licenses: "rose", Taxes: "olive",
  Property: "sand", Healthcare: "aqua", Education: "lilac", Other: "slate",
};

const categoryIcons: Record<Category, LucideIcon> = {
  Documents: FileText,
  Cards: CreditCard,
  Subscriptions: RefreshCw,
  Memberships: UsersRound,
  Vehicle: CarFront,
  Insurance: ShieldCheck,
  Warranty: BadgeCheck,
  Utilities: Lightbulb,
  Software: Laptop,
  Domains: Globe2,
  Licenses: KeyRound,
  Taxes: ReceiptText,
  Property: House,
  Healthcare: HeartPulse,
  Education: GraduationCap,
  Other: Shapes,
};

function CategoryIcon({ category }: { category: Category }) {
  const Icon = categoryIcons[category];
  return <Icon aria-hidden="true" focusable="false" strokeWidth={2.1} />;
}

function daysUntil(date: string) {
  return Math.ceil((new Date(`${date}T09:00:00`).getTime() - today.getTime()) / 86400000);
}

function money(value: number, currency: "PKR" | "USD" = "PKR") {
  return currency === "PKR" ? `Rs ${value.toLocaleString("en-PK")}` : `$${value.toLocaleString("en-US")}`;
}

function humanDate(date: string, withYear = false) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) }).format(new Date(`${date}T09:00:00`));
}

function describeReminder(reminder: Reminder) {
  if (reminder.mode === "date") return reminder.date ? `On ${humanDate(reminder.date, true)}` : "Specific date";
  const months = reminder.months || 0;
  const days = reminder.days || 0;
  if (reminder.mode === "manual") return `${days} ${days === 1 ? "day" : "days"} before`;
  if (months && days) return `${months} ${months === 1 ? "month" : "months"} and ${days} ${days === 1 ? "day" : "days"} before`;
  if (months) return `${months} ${months === 1 ? "month" : "months"} before`;
  return `${days} ${days === 1 ? "day" : "days"} before`;
}

function nextDate(date: string, frequency: string, from = date) {
  const d = new Date(`${from}T09:00:00`);
  if (frequency === "Monthly") d.setMonth(d.getMonth() + 1);
  else if (frequency === "Quarterly") d.setMonth(d.getMonth() + 3);
  else if (frequency === "Every 6 months") d.setMonth(d.getMonth() + 6);
  else if (frequency === "Yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [items, setItems] = useState<RenewalItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<RenewalItem | null>(null);
  const [renewing, setRenewing] = useState<RenewalItem | null>(null);
  const [detail, setDetail] = useState<RenewalItem | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");

  useEffect(() => {
    auth.getUser().then(current => { setUser(current); setAuthReady(true); });
    return auth.onChange(current => { setUser(current); setAuthReady(true); });
  }, []);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    renewalStore.list().then(setItems).catch(error => flash(error.message));
  }, [user]);

  const upcoming = useMemo(() => [...items].filter(i => daysUntil(i.dueDate) >= 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [items]);
  const pkTotal30 = upcoming.filter(i => daysUntil(i.dueDate) <= 30 && i.currency === "PKR").reduce((sum, i) => sum + (i.amount || 0), 0);
  const attention = upcoming.filter(i => daysUntil(i.dueDate) <= 45);
  const filtered = items.filter(i => (filter === "All" || i.category === filter) && `${i.name} ${i.category} ${i.person}`.toLowerCase().includes(search.toLowerCase()));

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const category = data.get("category") as Category;
    const item: RenewalItem = {
      id: crypto.randomUUID(),
      name: String(data.get("name")),
      category,
      dueDate: String(data.get("dueDate")),
      startDate: String(data.get("startDate") || ""),
      amount: data.get("amount") ? Number(data.get("amount")) : undefined,
      currency: data.get("currency") as "PKR" | "USD",
      recurring: data.get("recurring") === "on",
      frequency: String(data.get("frequency")),
      reminderDays: String(data.get("reminderDays")).split(",").map(v => Number(v.trim())).filter(Boolean),
      reminders: JSON.parse(String(data.get("reminders") || "[]")) as Reminder[],
      person: String(data.get("person")),
      notes: String(data.get("notes") || ""),
      renewalRule: data.get("renewalRule") as RenewalRule,
      accent: categoryAccent[category],
    };
    try {
      const saved = await renewalStore.create({ ...item, id: undefined });
      setItems(current => [...current, saved]);
      setAddOpen(false);
      flash(`${item.name} was added`);
    } catch {
      flash("Could not save this item. Please try again.");
    }
  }

  async function completeRenewal(choice: "fixed" | "actual" | "custom", customDate?: string) {
    if (!renewing) return;
    const actual = new Date().toISOString().slice(0, 10);
    const dueDate = choice === "custom" && customDate ? customDate : nextDate(renewing.dueDate, renewing.frequency, choice === "actual" ? actual : renewing.dueDate);
    const rule = choice === "custom" ? renewing.renewalRule : choice;
    try {
      const saved = await renewalStore.renew(renewing.id, { actualDate: actual, nextDate: dueDate, scheduledDate: renewing.dueDate, amountPaid: renewing.amount, rule });
      setItems(current => current.map(item => item.id === renewing.id ? saved : item));
      setRenewing(null);
      setDetail(null);
      flash(`Renewal recorded · next due ${humanDate(dueDate, true)}`);
    } catch {
      flash("Could not record this renewal. Please try again.");
    }
  }

  async function deleteItem(item: RenewalItem) {
    try {
      await renewalStore.remove(item.id);
      setItems(current => current.filter(i => i.id !== item.id));
      setDetail(null);
      flash("Item removed");
    } catch {
      flash("Could not remove this item. Please try again.");
    }
  }

  async function updateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const category = data.get("category") as Category;
    const changes: RenewalItem = {
      ...editing,
      name: String(data.get("name")),
      category,
      dueDate: String(data.get("dueDate")),
      startDate: String(data.get("startDate") || ""),
      amount: data.get("amount") ? Number(data.get("amount")) : undefined,
      currency: data.get("currency") as "PKR" | "USD",
      recurring: data.get("recurring") === "on",
      frequency: String(data.get("frequency")),
      reminderDays: String(data.get("reminderDays")).split(",").map(v => Number(v.trim())).filter(Boolean),
      reminders: JSON.parse(String(data.get("reminders") || "[]")) as Reminder[],
      person: String(data.get("person")),
      notes: String(data.get("notes") || ""),
      renewalRule: data.get("renewalRule") as RenewalRule,
      accent: categoryAccent[category],
    };
    try {
      const saved = await renewalStore.update(editing.id, changes);
      setItems(current => current.map(item => item.id === saved.id ? saved : item));
      setEditing(null);
      setDetail(null);
      flash(`${saved.name} was updated`);
    } catch {
      flash("Could not update this item. Please try again.");
    }
  }

  function openEditor(item: RenewalItem) {
    setDetail(null);
    setEditing(item);
  }

  if (!authReady) return <div className="auth-screen"><div className="auth-card"><span className="brand-mark">R</span><p>Loading your renewals…</p></div></div>;
  if (!user) return <AuthScreen />;

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "You";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("today")} aria-label="Go to Today">
          <span className="brand-mark">R</span><span>Renewal<span className="brand-dot">.</span></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <NavButton active={view === "today"} icon={CalendarCheck} label="Today" onClick={() => setView("today")} />
          <NavButton active={view === "items"} icon={ListChecks} label="All items" count={items.length} onClick={() => setView("items")} />
          <NavButton active={view === "calendar"} icon={CalendarDays} label="Calendar" onClick={() => setView("calendar")} />
          <NavButton active={view === "family"} icon={UsersRound} label="Family" onClick={() => setView("family")} />
        </nav>
        <div className="side-bottom">
          <button className="nav-button" onClick={() => setView("settings")}><span className="nav-glyph"><Settings aria-hidden="true" /></span><span>Settings</span></button>
          <button className="profile-chip profile-button" onClick={() => auth.signOut()}><span className="avatar">{displayName.slice(0, 2).toUpperCase()}</span><span><strong>{displayName}</strong><small>Sign out</small></span><span className="more"><MoreHorizontal aria-hidden="true" /></span></button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark small">R</span><strong>Renewal<span className="brand-dot">.</span></strong></div>
          <div className="searchbox"><span><Search aria-hidden="true" /></span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your renewals" /><kbd>⌘ K</kbd></div>
          <button className="icon-button" aria-label="Notifications"><Bell aria-hidden="true" /><span className="notification-dot" /></button>
          <button className="primary-button" onClick={() => setAddOpen(true)}><span><Plus aria-hidden="true" /></span>Add item</button>
        </header>

        {view === "today" && <TodayView name={displayName} attention={attention} upcoming={upcoming} total={pkTotal30} onOpen={setDetail} onEdit={openEditor} onRenew={setRenewing} onSeeAll={() => setView("items")} onAdd={() => setAddOpen(true)} />}
        {view === "items" && <ItemsView items={filtered} filter={filter} setFilter={setFilter} onOpen={setDetail} onRenew={setRenewing} onAdd={() => setAddOpen(true)} />}
        {view === "calendar" && <CalendarView items={items} onOpen={setDetail} />}
        {view === "family" && <FamilyView items={items} />}
        {view === "settings" && <SettingsView flash={flash} />}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton active={view === "today"} icon={CalendarCheck} label="Today" onClick={() => setView("today")} />
        <NavButton active={view === "items"} icon={ListChecks} label="Items" onClick={() => setView("items")} />
        <button className="mobile-add" onClick={() => setAddOpen(true)} aria-label="Add item"><Plus aria-hidden="true" /></button>
        <NavButton active={view === "calendar"} icon={CalendarDays} label="Calendar" onClick={() => setView("calendar")} />
        <NavButton active={view === "family"} icon={UsersRound} label="Family" onClick={() => setView("family")} />
      </nav>

      {addOpen && <AddItemModal onClose={() => setAddOpen(false)} onSubmit={addItem} />}
      {editing && <AddItemModal initialItem={editing} onClose={() => setEditing(null)} onSubmit={updateItem} />}
      {renewing && <RenewModal item={renewing} onClose={() => setRenewing(null)} onComplete={completeRenewal} />}
      {detail && <DetailDrawer item={detail} onClose={() => setDetail(null)} onEdit={() => openEditor(detail)} onRenew={() => setRenewing(detail)} onDelete={() => deleteItem(detail)} />}
      {toast && <div className="toast"><span><Check aria-hidden="true" /></span>{toast}</div>}
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      if (mode === "signin") await auth.signIn(String(data.get("email")), String(data.get("password")));
      else {
        await auth.signUp(String(data.get("email")), String(data.get("password")), String(data.get("name")));
        setMessage("Account created. Check your email if confirmation is enabled.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">R</span><strong>Renewal<span className="brand-dot">.</span></strong></div><span className="modal-kicker">YOUR IMPORTANT DATES</span><h1>{mode === "signin" ? "Welcome back." : "Create your account."}</h1><p>Renewals, expiries and reminders—kept quietly under control.</p><form onSubmit={submit}>{mode === "signup" && <label className="field"><span>NAME</span><input name="name" autoComplete="name" required /></label>}<label className="field"><span>EMAIL</span><input name="email" type="email" autoComplete="email" required /></label><label className="field"><span>PASSWORD</span><input name="password" type="password" minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} required /></label>{message && <div className="auth-message">{message}</div>}<button className="primary-button full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button></form><button className="auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button></section></main>;
}

function NavButton({ active, icon: Icon, label, count, onClick }: { active: boolean; icon: LucideIcon; label: string; count?: number; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><span className="nav-glyph"><Icon aria-hidden="true" /></span><span className="nav-label">{label}</span>{count !== undefined && <span className="nav-count">{count}</span>}</button>;
}

function TodayView({ name, attention, upcoming, total, onOpen, onEdit, onRenew, onSeeAll, onAdd }: { name: string; attention: RenewalItem[]; upcoming: RenewalItem[]; total: number; onOpen: (i: RenewalItem) => void; onEdit: (i: RenewalItem) => void; onRenew: (i: RenewalItem) => void; onSeeAll: () => void; onAdd: () => void }) {
  const todayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(today).toUpperCase();
  const costMap = upcoming.filter(i => daysUntil(i.dueDate) <= 30 && i.currency === "PKR").reduce<Record<string, number>>((sum, item) => ({ ...sum, [item.category]: (sum[item.category] || 0) + (item.amount || 0) }), {});
  const costRows = Object.entries(costMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const yearly = upcoming.filter(i => i.currency === "PKR").reduce((sum, item) => sum + (item.amount || 0) * (item.frequency === "Monthly" ? 12 : item.frequency === "Quarterly" ? 4 : item.frequency === "Every 6 months" ? 2 : 1), 0);
  return <div className="page today-page">
    <div className="eyebrow">{todayLabel}</div>
    <div className="page-title-row"><div><h1>Hello, {name}.</h1><p>{attention.length ? `${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} your attention soon.` : "Your important dates, calmly organized."}</p></div><div className="mini-streak"><span><Check aria-hidden="true" /></span><div><strong>All caught up</strong><small>No overdue items</small></div></div></div>

    {!upcoming.length && <section className="empty-state panel"><span className="category-icon xl"><Plus aria-hidden="true" /></span><div><h2>Add your first renewal</h2><p>Track a subscription, document, insurance policy, domain, tax, or any important expiry.</p></div><button className="primary-button" onClick={onAdd}>Add item</button></section>}

    {!!upcoming.length && <section className="attention-section">
      <div className="section-heading"><div><span className="pulse-dot" /><h2>Needs attention</h2></div><button onClick={onSeeAll}>View all <span>→</span></button></div>
      <div className="attention-grid">
        {attention.slice(0, 3).map((item, index) => <AttentionCard key={item.id} item={item} index={index} onOpen={() => onOpen(item)} onEdit={() => onEdit(item)} onRenew={() => onRenew(item)} />)}
      </div>
    </section>}

    {!!upcoming.length && <section className="dashboard-grid">
      <div className="panel upcoming-panel">
        <div className="panel-heading"><div><span className="panel-icon"><TrendingUp aria-hidden="true" /></span><div><h2>Coming up</h2><p>Your next important dates</p></div></div><button className="text-button" onClick={onSeeAll}>See calendar</button></div>
        <div className="timeline-list">
          {upcoming.slice(0, 4).map(item => <button key={item.id} className="timeline-row" onClick={() => onOpen(item)}><div className="date-tile"><strong>{new Date(`${item.dueDate}T09:00:00`).getDate()}</strong><small>{new Date(`${item.dueDate}T09:00:00`).toLocaleString("en", { month: "short" }).toUpperCase()}</small></div><span className={`category-icon ${item.accent}`}><CategoryIcon category={item.category} /></span><div className="timeline-info"><strong>{item.name}</strong><small>{item.category} · {item.person}</small></div>{item.amount && <strong className="row-amount">{money(item.amount, item.currency)}</strong>}<span className="row-arrow"><ChevronRight aria-hidden="true" /></span></button>)}
        </div>
      </div>
      <div className="panel commitments-panel">
        <div className="panel-heading"><div><span className="panel-icon pale"><PieChart aria-hidden="true" /></span><div><h2>Renewal costs</h2><p>Know what&apos;s ahead</p></div></div><button className="dots" aria-label="More cost options"><MoreHorizontal aria-hidden="true" /></button></div>
        <div className="cost-main"><small>NEXT 30 DAYS</small><strong>{money(total)}</strong><span><b>{yearly ? Math.round((total / yearly) * 100) : 0}%</b> of yearly total</span></div>
        <div className="cost-bars">{costRows.length ? costRows.map(([category, amount], index) => <div key={category}><span><b>{category}</b><em>{money(amount)}</em></span><i><u className={index ? "violet-bar" : ""} style={{ width: `${Math.max(8, Math.round((amount / Math.max(total, 1)) * 100))}%` }} /></i></div>) : <p className="no-costs">No PKR costs due in the next 30 days.</p>}</div>
        <div className="year-total"><span>Estimated next 12 months</span><strong>{money(yearly)}</strong></div>
      </div>
    </section>}
    {!!upcoming.length && <div className="insight"><span className="insight-mark">✦</span><div><strong>A little planning goes a long way</strong><p>Review your largest upcoming renewal early and set aside a small amount each week.</p></div><button>Got it</button></div>}
  </div>;
}

function AttentionCard({ item, index, onOpen, onEdit, onRenew }: { item: RenewalItem; index: number; onOpen: () => void; onEdit: () => void; onRenew: () => void }) {
  const days = daysUntil(item.dueDate);
  const [menuOpen, setMenuOpen] = useState(false);
  return <article className={`attention-card priority-${index}`}>
    <button className="card-body" onClick={onOpen}>
      <div className="card-top"><span className={`category-icon large ${item.accent}`}><CategoryIcon category={item.category} /></span><span className="urgency">{days <= 5 ? "Soon" : days <= 14 ? "Upcoming" : "Plan ahead"}</span></div>
      <h3>{item.name}</h3><p>{item.recurring ? "Renews" : "Expires"} in <b>{days} days</b></p>
      <div className="card-meta"><span>{humanDate(item.dueDate)}</span>{item.amount && <span>{money(item.amount, item.currency)}</span>}</div>
    </button>
    <div className="card-actions"><button onClick={onRenew}>Mark renewed</button><button className="edit-card-button" onClick={onEdit}>Edit</button><button className="more-button" aria-label={`More options for ${item.name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}><MoreHorizontal aria-hidden="true" /></button></div>
    {menuOpen && <div className="card-menu" role="menu"><button role="menuitem" onClick={() => { setMenuOpen(false); onOpen(); }}>View details</button><button role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }}>Edit item</button></div>}
  </article>;
}

function ItemsView({ items, filter, setFilter, onOpen, onRenew, onAdd }: { items: RenewalItem[]; filter: string; setFilter: (s: string) => void; onOpen: (i: RenewalItem) => void; onRenew: (i: RenewalItem) => void; onAdd: () => void }) {
  const filters = ["All", "Documents", "Cards", "Subscriptions", "Memberships", "Insurance"];
  return <div className="page"><div className="eyebrow">YOUR IMPORTANT DATES</div><div className="page-title-row compact"><div><h1>All items</h1><p>Everything you need to renew, replace or remember.</p></div><button className="secondary-button" onClick={onAdd}><Plus aria-hidden="true" /> Add item</button></div>
    <div className="filter-row">{filters.map(f => <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>{f}</button>)}</div>
    <div className="items-table panel"><div className="table-head"><span>Item</span><span>Owner</span><span>Next date</span><span>Amount</span><span>Status</span><span /></div>{items.map(item => { const days = daysUntil(item.dueDate); return <div className="item-row" key={item.id}><button className="item-name" onClick={() => onOpen(item)}><span className={`category-icon ${item.accent}`}><CategoryIcon category={item.category} /></span><span><strong>{item.name}</strong><small>{item.category} · {item.frequency}</small></span></button><span>{item.person}</span><span>{humanDate(item.dueDate, true)}</span><strong>{item.amount ? money(item.amount, item.currency) : "—"}</strong><span className={`status ${days < 15 ? "soon" : "safe"}`}>{days < 15 ? `${days} days` : "On track"}</span><button className="renew-link" onClick={() => onRenew(item)}>Renew</button></div>})}</div>
  </div>;
}

function CalendarView({ items, onOpen }: { items: RenewalItem[]; onOpen: (i: RenewalItem) => void }) {
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthItems = items.filter(i => i.dueDate.startsWith(prefix));
  const firstDay = new Date(year, month, 1).getDay();
  const blanks = firstDay === 0 ? 6 : firstDay - 1;
  const cells = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1);
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(cursor);
  const moveMonth = (by: number) => setCursor(new Date(year, month + by, 1));
  return <div className="page calendar-page"><div className="eyebrow">ONE MONTH AT A GLANCE</div><div className="page-title-row compact"><div><h1>Renewal calendar</h1><p>See every payment, expiry and renewal in context.</p></div><div className="month-control"><button onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></button><strong>{monthLabel}</strong><button onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight aria-hidden="true" /></button></div></div>
    <div className="calendar panel"><div className="weekdays">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(d => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{Array.from({ length: blanks }).map((_, i) => <div className="day muted" key={`blank-${i}`} />)}{cells.map(day => { const events = monthItems.filter(i => Number(i.dueDate.slice(-2)) === day); const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear(); return <div className={`day ${isToday ? "today" : ""}`} key={day}><span className="day-number">{day}</span>{events.map(item => <button key={item.id} className={`calendar-event ${item.accent}`} onClick={() => onOpen(item)}><i />{item.name}<small>{item.amount ? money(item.amount, item.currency) : item.category}</small></button>)}</div>})}</div></div>
  </div>;
}

function FamilyView({ items }: { items: RenewalItem[] }) {
  const members = [{ name: "Ahmad", relation: "You", initials: "AI", color: "coral" }, { name: "Family", relation: "Shared", initials: "FM", color: "violet" }, { name: "Business", relation: "Work", initials: "SC", color: "blue" }];
  return <div className="page"><div className="eyebrow">PEOPLE & RESPONSIBILITIES</div><div className="page-title-row compact"><div><h1>Family & groups</h1><p>Keep everyone&apos;s important dates together.</p></div><button className="secondary-button"><Plus aria-hidden="true" /> Add person</button></div><div className="member-grid">{members.map(member => { const memberItems = items.filter(i => i.person === member.name); return <article className="member-card panel" key={member.name}><div className="member-top"><span className={`member-avatar ${member.color}`}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.relation}</small></span><button aria-label={`More options for ${member.name}`}><MoreHorizontal aria-hidden="true" /></button></div><div className="member-stats"><div><strong>{memberItems.length}</strong><small>Items</small></div><div><strong>{memberItems.filter(i => daysUntil(i.dueDate) < 60).length}</strong><small>Due soon</small></div></div><div className="member-list">{memberItems.slice(0, 3).map(i => <div key={i.id}><span className={`tiny-dot ${i.accent}`} /><span>{i.name}</span><small>{humanDate(i.dueDate)}</small></div>)}</div></article>})}</div></div>;
}

function SettingsView({ flash }: { flash: (s: string) => void }) {
  return <div className="page narrow-page"><div className="eyebrow">YOUR PREFERENCES</div><div className="page-title-row compact"><div><h1>Settings</h1><p>Choose how and when Renewal keeps you informed.</p></div></div><section className="settings-panel panel"><h2>Notifications</h2><p>Important alerts for renewals and expiries.</p><SettingToggle title="Email reminders" detail="Receive a clear summary before each important date." checked /><SettingToggle title="Browser notifications" detail="Get timely alerts on this device." checked={false} /><SettingToggle title="Weekly digest" detail="A Sunday overview of the week ahead." checked /><button className="primary-button save-settings" onClick={() => flash("Preferences saved")}>Save preferences</button></section></div>;
}

function SettingToggle({ title, detail, checked }: { title: string; detail: string; checked: boolean }) {
  const [on, setOn] = useState(checked);
  return <div className="setting-row"><span><strong>{title}</strong><small>{detail}</small></span><button role="switch" aria-checked={on} className={`toggle ${on ? "on" : ""}`} onClick={() => setOn(!on)}><i /></button></div>;
}

function AddItemModal({ onClose, onSubmit, initialItem }: { onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void; initialItem?: RenewalItem }) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category>(initialItem?.category || "Subscriptions");
  const [recurring, setRecurring] = useState(initialItem?.recurring ?? true);
  const [frequency, setFrequency] = useState(initialItem?.frequency || "Monthly");
  const [name, setName] = useState(initialItem?.name || "");
  const [person, setPerson] = useState(initialItem?.person || "Ahmad");
  const [reminders, setReminders] = useState<Array<Reminder & { id: number; saved: boolean }>>(() => {
    const existing = initialItem?.reminders?.length
      ? initialItem.reminders
      : initialItem?.reminderDays.map(days => ({ mode: "manual" as const, days }));
    return existing?.length
      ? existing.map((reminder, index) => ({ ...reminder, id: index + 1, saved: true }))
      : [{ id: 1, mode: "relative", days: 7, saved: false }];
  });

  const activeFrequency = recurring ? frequency : "Once";
  const maxMonths = activeFrequency === "Quarterly" ? 2 : activeFrequency === "Every 6 months" ? 5 : activeFrequency === "Yearly" ? 11 : 0;
  const dayOptions = Array.from({ length: 30 }, (_, index) => index + 1);

  function updateReminder(id: number, values: Partial<Reminder & { saved: boolean }>) {
    setReminders(current => current.map(reminder => reminder.id === id ? { ...reminder, ...values } : reminder));
  }

  function saveReminder(id: number) {
    const reminder = reminders.find(item => item.id === id);
    if (!reminder) return;
    const valid = reminder.mode === "date" ? Boolean(reminder.date) : Boolean(reminder.days || reminder.months);
    if (valid) updateReminder(id, { saved: true, ...(reminder.mode === "relative" && maxMonths > 0 ? { months: reminder.months || 1 } : {}) });
  }

  function addReminder() {
    const previous = reminders.at(-1);
    const copy: Reminder = previous ? { mode: previous.mode, months: previous.months, days: previous.days, date: previous.date } : { mode: "relative", days: 7 };
    setReminders(current => [...current, { ...copy, id: Date.now(), saved: false }]);
  }

  function removeReminder(id: number) {
    setReminders(current => current.filter(reminder => reminder.id !== id));
  }

  function changeFrequency(value: string) {
    setFrequency(value);
    setReminders(current => current.map(reminder => reminder.mode === "relative" ? { ...reminder, months: undefined, days: value === "Monthly" ? Math.min(reminder.days || 7, 30) : reminder.days || 0, saved: false } : reminder));
  }

  const savedReminders = reminders.filter(reminder => reminder.saved);
  const reminderDays = savedReminders.flatMap(reminder => reminder.mode === "date" ? [] : [(reminder.months || 0) * 30 + (reminder.days || 0)]).filter(Boolean);

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal add-modal">
      <div className="modal-header"><div><span className="modal-kicker">{initialItem ? "EDIT ITEM" : "NEW ITEM"} · STEP {step} OF 2</span><h2>{step === 1 ? (initialItem ? "Edit item details" : "What do you want to remember?") : "Set the date and reminders"}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button></div>
      <form onSubmit={onSubmit}>
        {step === 1 ? <div className="form-step">
          <label className="field"><span>ITEM NAME</span><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Netflix, Passport, Car insurance" required autoFocus /></label>
          <div className="field"><span>CATEGORY</span><div className="category-picker">{(Object.keys(categoryAccent) as Category[]).map(c => <button type="button" key={c} className={category === c ? "selected" : ""} onClick={() => setCategory(c)}><span className={`category-icon ${categoryAccent[c]}`}><CategoryIcon category={c} /></span>{c}</button>)}</div></div>
          <label className="field"><span>WHO IS THIS FOR?</span><select value={person} onChange={e => setPerson(e.target.value)}><option>Ahmad</option><option>Family</option><option>Business</option></select></label>
          <div className="modal-footer"><span /><button type="button" className="primary-button" disabled={!name.trim()} onClick={() => setStep(2)}>Continue <span>→</span></button></div>
        </div> : <div className="form-step">
          <input type="hidden" name="name" value={name} /><input type="hidden" name="category" value={category} /><input type="hidden" name="person" value={person} /><input type="hidden" name="reminderDays" value={reminderDays.join(",")} /><input type="hidden" name="reminders" value={JSON.stringify(savedReminders.map(({ id: _id, saved: _saved, ...reminder }) => reminder))} />
          <div className="two-fields"><label className="field"><span>ISSUE / START DATE</span><input name="startDate" type="date" defaultValue={initialItem?.startDate || ""} /></label><label className="field"><span>NEXT EXPIRY / RENEWAL</span><input name="dueDate" type="date" required defaultValue={initialItem?.dueDate || new Date().toISOString().slice(0, 10)} /></label></div>
          <div className="two-fields"><label className="field"><span>RENEWAL AMOUNT <em>OPTIONAL</em></span><input name="amount" type="number" min="0" placeholder="0" defaultValue={initialItem?.amount} /></label><label className="field"><span>CURRENCY</span><select name="currency" defaultValue={initialItem?.currency || "PKR"}><option>PKR</option><option>USD</option></select></label></div>
          <label className="check-row"><span><strong>Recurring renewal</strong><small>Automatically calculate the next date</small></span><input className="switch-input" name="recurring" type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} /><span className={`form-switch ${recurring ? "on" : ""}`} aria-hidden="true"><i /></span></label>
          {recurring && <><label className="field"><span>FREQUENCY</span><select name="frequency" value={frequency} onChange={e => changeFrequency(e.target.value)}><option>Monthly</option><option>Quarterly</option><option>Every 6 months</option><option>Yearly</option><option>Custom</option></select></label><div className="field"><span>WHEN I RENEW LATE</span><label className="radio-card"><input type="radio" name="renewalRule" value="ask" defaultChecked={!initialItem || initialItem.renewalRule === "ask"} /><span><strong>Ask me each time</strong><small>Recommended · choose the next date when you renew</small></span></label><label className="radio-card"><input type="radio" name="renewalRule" value="fixed" defaultChecked={initialItem?.renewalRule === "fixed"} /><span><strong>Keep original schedule</strong><small>Stay anchored to the existing billing date</small></span></label><label className="radio-card"><input type="radio" name="renewalRule" value="actual" defaultChecked={initialItem?.renewalRule === "actual"} /><span><strong>Move to actual renewal date</strong><small>Start the next period from when you paid</small></span></label></div></>}
          {!recurring && <><input type="hidden" name="frequency" value="Once" /><input type="hidden" name="renewalRule" value="ask" /></>}
          <div className="field reminder-field"><span>REMINDERS</span>
            <div className="reminder-list">{reminders.map((reminder, index) => reminder.saved ? <div className="saved-reminder" key={reminder.id}><span className="reminder-number">{index + 1}</span><strong>{describeReminder(reminder)}</strong><button type="button" onClick={() => updateReminder(reminder.id, { saved: false })}>Edit</button><button type="button" className="remove-reminder" onClick={() => removeReminder(reminder.id)} aria-label="Remove reminder">×</button></div> : <div className="reminder-editor" key={reminder.id}>
              <div className="reminder-editor-top"><strong>Reminder {index + 1}</strong>{reminders.length > 1 && <button type="button" onClick={() => removeReminder(reminder.id)}>Remove</button>}</div>
              <label className="reminder-option"><input type="radio" checked={reminder.mode === "relative"} onChange={() => updateReminder(reminder.id, { mode: "relative", date: undefined })} /><span>Based on renewal period</span></label>
              {reminder.mode === "relative" && <div className="relative-controls">{maxMonths > 0 && <><select value={reminder.months || 1} onChange={e => updateReminder(reminder.id, { months: Number(e.target.value) })} aria-label="Months before"><option value="">Months</option>{Array.from({ length: maxMonths }, (_, i) => i + 1).map(month => <option key={month} value={month}>{month} {month === 1 ? "month" : "months"}</option>)}</select><span>+</span></>}<select value={reminder.days || (maxMonths ? 0 : 7)} onChange={e => updateReminder(reminder.id, { days: Number(e.target.value) })} aria-label="Days before">{maxMonths > 0 && <option value="0">0 days</option>}{dayOptions.map(day => <option key={day} value={day}>{day} {day === 1 ? "day" : "days"}</option>)}</select><span>before</span></div>}
              <label className="reminder-option"><input type="radio" checked={reminder.mode === "manual"} onChange={() => updateReminder(reminder.id, { mode: "manual", months: undefined, date: undefined })} /><span>Enter days manually</span></label>
              {reminder.mode === "manual" && <div className="manual-days"><input type="number" min="1" max="3650" value={reminder.days || ""} onChange={e => updateReminder(reminder.id, { days: Number(e.target.value) })} placeholder="15" /><span>days before</span></div>}
              <label className="reminder-option"><input type="radio" checked={reminder.mode === "date"} onChange={() => updateReminder(reminder.id, { mode: "date", months: undefined, days: undefined })} /><span>Remind me on a specific date</span></label>
              {reminder.mode === "date" && <input className="reminder-date" type="date" value={reminder.date || ""} onChange={e => updateReminder(reminder.id, { date: e.target.value })} />}
              <button type="button" className="save-reminder" onClick={() => saveReminder(reminder.id)}>Save reminder</button>
            </div>)}</div>
            {reminders.every(reminder => reminder.saved) && <button type="button" className="add-another-reminder" onClick={addReminder}><span><Plus aria-hidden="true" /></span>Add another reminder</button>}
            {savedReminders.length === 0 && <small className="reminder-hint">Save at least one reminder to continue.</small>}
          </div>
          <label className="field"><span>NOTES <em>OPTIONAL</em></span><textarea name="notes" placeholder="Anything useful for renewal…" defaultValue={initialItem?.notes || ""} /></label>
          <div className="modal-footer"><button type="button" className="back-button" onClick={() => setStep(1)}>← Back</button><button className="primary-button" type="submit" disabled={savedReminders.length === 0 || reminders.some(reminder => !reminder.saved)}>{initialItem ? "Save changes" : "Save item"}</button></div>
        </div>}
      </form>
    </div>
  </div>;
}

function RenewModal({ item, onClose, onComplete }: { item: RenewalItem; onClose: () => void; onComplete: (choice: "fixed" | "actual" | "custom", customDate?: string) => void }) {
  const actual = new Date().toISOString().slice(0, 10);
  const fixed = nextDate(item.dueDate, item.frequency, item.dueDate);
  const moved = nextDate(item.dueDate, item.frequency, actual);
  const [choice, setChoice] = useState<"fixed" | "actual" | "custom">(item.renewalRule === "actual" ? "actual" : "fixed");
  const [custom, setCustom] = useState(moved);
  return <div className="modal-backdrop"><div className="modal renew-modal"><button className="close-button floating" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button><div className={`renew-hero ${item.accent}`}><span><CategoryIcon category={item.category} /></span></div><span className="modal-kicker">RECORD RENEWAL</span><h2>{item.name} renewed?</h2><p>We&apos;ll save today as the actual renewal date and preserve the original schedule in history.</p><div className="renew-summary"><div><small>SCHEDULED</small><strong>{humanDate(item.dueDate, true)}</strong></div><span>→</span><div><small>RENEWED</small><strong>Today</strong></div></div><div className="choice-list"><button className={choice === "fixed" ? "selected" : ""} onClick={() => setChoice("fixed")}><i /><span><strong>{humanDate(fixed, true)}</strong><small>Keep original schedule</small></span><b>Fixed</b></button><button className={choice === "actual" ? "selected" : ""} onClick={() => setChoice("actual")}><i /><span><strong>{humanDate(moved, true)}</strong><small>Start from today&apos;s renewal</small></span><b>Flexible</b></button><button className={choice === "custom" ? "selected" : ""} onClick={() => setChoice("custom")}><i /><span><strong>Choose another date</strong><small>Set the exact next due date</small></span></button></div>{choice === "custom" && <input className="custom-date" type="date" value={custom} onChange={e => setCustom(e.target.value)} />}<button className="primary-button full" onClick={() => onComplete(choice, custom)}>Record renewal</button></div></div>;
}

function DetailDrawer({ item, onClose, onEdit, onRenew, onDelete }: { item: RenewalItem; onClose: () => void; onEdit: () => void; onRenew: () => void; onDelete: () => void }) {
  const reminderPlan = item.reminders?.length ? item.reminders.map(describeReminder).join(" · ") : item.reminderDays.map(d => `${d}d before`).join(" · ");
  return <div className="drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className="drawer"><div className="drawer-top"><button className="close-button" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button><span className={`category-icon xl ${item.accent}`}><CategoryIcon category={item.category} /></span><span className="category-label">{item.category}</span><h2>{item.name}</h2><p>{item.person}</p></div><div className="due-feature"><small>NEXT {item.recurring ? "RENEWAL" : "EXPIRY"}</small><strong>{humanDate(item.dueDate, true)}</strong><span>{daysUntil(item.dueDate)} days from now</span></div><div className="detail-list"><div><span>Amount</span><strong>{item.amount ? money(item.amount, item.currency) : "Not set"}</strong></div><div><span>Frequency</span><strong>{item.frequency}</strong></div><div><span>Reminder plan</span><strong>{reminderPlan || "None"}</strong></div><div><span>Late renewal rule</span><strong>{item.renewalRule === "ask" ? "Ask each time" : item.renewalRule === "fixed" ? "Keep schedule" : "From actual date"}</strong></div></div>{item.notes && <div className="notes-box"><small>NOTES</small><p>{item.notes}</p></div>}<div className="drawer-actions"><button className="primary-button" onClick={onRenew}><Check aria-hidden="true" /> Mark renewed</button><button className="secondary-button edit-drawer-button" onClick={onEdit}>Edit item</button><button className="danger-button" onClick={onDelete}>Delete item</button></div></aside></div>;
}
