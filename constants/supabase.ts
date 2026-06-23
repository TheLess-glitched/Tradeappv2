import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kgdebizxmrdczgjmwkeq.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnZGViaXp4bXJkY3pnam13a2VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjUzODksImV4cCI6MjA4OTcwMTM4OX0.pD21tZHoRdoEX0qpKN2PVujdPF7RVLJw9JfvPHGFcDs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
