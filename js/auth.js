function insidePages(){return location.pathname.includes('/pages/')}
function loginPath(){return insidePages()?'../login.html':'login.html'}
function adminPath(){return insidePages()?'dashboard.html':'pages/dashboard.html'}
async function protectPage(){
  const {data:{session}}=await cfSupabase.auth.getSession();
  if(!session){location.replace(new URL(loginPath(),location.href));return false}
  const {data:profile,error}=await cfSupabase.from('admin_profiles').select('user_id,is_active').eq('user_id',session.user.id).maybeSingle();
  if(error||!profile||profile.is_active===false){await cfSupabase.auth.signOut();alert('Akun ini belum terdaftar sebagai admin CRM.');location.replace(new URL(loginPath(),location.href));return false}
  return true;
}
async function loginEmail(e){
  e?.preventDefault();
  const box=document.getElementById('loginMessage'),btn=document.querySelector('#loginForm button[type="submit"]');
  box.hidden=true;btn.disabled=true;btn.textContent='Memproses...';
  try{
    const email=document.getElementById('loginEmail').value.trim();
    const password=document.getElementById('loginPassword').value;
    const {data,error}=await cfSupabase.auth.signInWithPassword({email,password});
    if(error)throw error;
    const {data:profile,error:profileError}=await cfSupabase.from('admin_profiles').select('*').eq('user_id',data.user.id).maybeSingle();
    if(profileError||!profile||profile.is_active===false){await cfSupabase.auth.signOut();throw new Error('Akun berhasil login, tetapi belum terdaftar sebagai admin aktif.')}
    location.replace(new URL(adminPath(),location.href));
  }catch(err){box.hidden=false;box.textContent=err.message||'Login gagal.';box.className='login-message error'}
  finally{btn.disabled=false;btn.textContent='Login'}
}
async function logout(){await cfSupabase.auth.signOut();location.replace(new URL(loginPath(),location.href))}
document.addEventListener('DOMContentLoaded',async()=>{
  const form=document.getElementById('loginForm');
  if(form){const {data:{session}}=await cfSupabase.auth.getSession();if(session)location.replace(new URL(adminPath(),location.href));form.addEventListener('submit',loginEmail)}
});
