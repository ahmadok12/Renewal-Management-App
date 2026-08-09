import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error("Missing Supabase configuration. Copy .env.example to .env and add your project URL and publishable key.");
}

export const supabase = createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const toItem = (row: Record<string, any>) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  dueDate: row.due_date,
  startDate: row.start_date || undefined,
  amount: row.amount === null ? undefined : Number(row.amount),
  currency: row.currency,
  recurring: row.recurring,
  frequency: row.frequency,
  reminderDays: row.reminder_days || [],
  reminders: row.reminders || [],
  person: row.person,
  notes: row.notes || undefined,
  renewalRule: row.renewal_rule,
  accent: row.accent,
});

const toRow = (item: Record<string, any>) => ({
  name: item.name,
  category: item.category,
  due_date: item.dueDate,
  start_date: item.startDate || null,
  amount: item.amount ?? null,
  currency: item.currency,
  recurring: item.recurring,
  frequency: item.frequency,
  reminder_days: item.reminderDays || [],
  reminders: item.reminders || [],
  person: item.person,
  notes: item.notes || null,
  renewal_rule: item.renewalRule,
  accent: item.accent,
});

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const auth = {
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    fail(error);
    return data.user;
  },
  onChange(callback: (user: any) => void) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  },
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    fail(error);
  },
  async signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    fail(error);
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    fail(error);
  },
};

export const renewalStore = {
  async list() {
    const { data, error } = await supabase.from("renewal_items").select("*").order("due_date");
    fail(error);
    return (data || []).map(toItem);
  },
  async create(item: Record<string, any>) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    fail(userError);
    if (!userData.user) throw new Error("Please sign in again.");
    const { data, error } = await supabase.from("renewal_items").insert({ ...toRow(item), user_id: userData.user.id }).select().single();
    fail(error);
    return toItem(data);
  },
  async renew(id: string, event: { actualDate: string; nextDate: string; scheduledDate: string; amountPaid?: number; rule: string }) {
    const { data, error } = await supabase.rpc("record_renewal", {
      p_item_id: id,
      p_scheduled_date: event.scheduledDate,
      p_actual_date: event.actualDate,
      p_next_date: event.nextDate,
      p_amount_paid: event.amountPaid ?? null,
      p_rule: event.rule,
    });
    fail(error);
    return toItem(data);
  },
  async remove(id: string) {
    const { error } = await supabase.from("renewal_items").delete().eq("id", id);
    fail(error);
  },
};
