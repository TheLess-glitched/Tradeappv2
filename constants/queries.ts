import { supabase } from "./supabase";

export function catalogueListQuery(businessId: string) {
  return supabase
    .from("catalogue")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
}

export function trackedCatalogueListQuery(businessId: string) {
  return supabase
    .from("catalogue")
    .select("id, name, selling_price, cost_price, quantity, unit, reorder_level, track_stock")
    .eq("business_id", businessId)
    .eq("track_stock", true)
    .order("name", { ascending: true });
}

export function jobCataloguePickerQuery(businessId: string) {
  return supabase
    .from("catalogue")
    .select("id, name, quantity, unit, selling_price, track_stock, reorder_level")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
}

export function catalogueItemQuery(id: string, businessId: string) {
  return supabase
    .from("catalogue")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
}

export function customersListQuery(businessId: string) {
  return supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
}

export function jobCustomerPickerQuery(businessId: string) {
  return supabase
    .from("customers")
    .select("id, name, phone")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
}

export function customerByPhoneQuery(businessId: string, phone: string) {
  return supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();
}

export function customerPhoneByNameQuery(businessId: string | null, name: string) {
  return supabase
    .from("customers")
    .select("phone")
    .eq("name", name)
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();
}

export function firstRecordQuery(businessId: string) {
  return supabase
    .from("jobs")
    .select("created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
    .limit(1);
}

export function jobsListQuery(businessId: string | null) {
  return supabase
    .from("jobs")
    .select("id, customer_name, customer_phone, service, record_type, line_total, date, time, notes, status, created_at, created_by, created_by_name, voided_at, void_reason")
    .eq("business_id", businessId)
    .eq("record_type", "job")
    .order("created_at", { ascending: false });
}