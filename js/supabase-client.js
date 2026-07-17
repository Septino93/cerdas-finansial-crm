(function(){
  const cfg=window.CF_CONFIG||{};
  if(!window.supabase) throw new Error('Library Supabase belum dimuat.');
  if(!cfg.supabaseUrl||!cfg.supabasePublishableKey) throw new Error('Konfigurasi Supabase belum lengkap.');
  window.cfSupabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
})();
