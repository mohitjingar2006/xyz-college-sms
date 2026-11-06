/**
 * MEMBER A: Auth & Tab Navigation Handler
 */

function switchRoleTab(role) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${role}`).classList.add('active');
  document.getElementById('selectedRole').value = role;
}

function openForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.remove('hidden');
}

function closeForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.add('hidden');
}

function handlePasswordResetSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('resetEmail').value;
  const q1 = document.getElementById('secQ1').value;
  const q2 = document.getElementById('secQ2').value;

  if (email && q1 && q2) {
    alert(`Password reset verification successful for ${email}. You may now log in with your new password.`);
    closeForgotPasswordModal();
  }
}

function handleLogin(e) {
  e.preventDefault();
  const role = document.getElementById('selectedRole').value;
  const email = document.getElementById('loginEmail').value;

  // Mock authenticated payload for layout preview
  window.currentUser = {
    id: "USR-001",
    name: role === 'student' ? 'Alex Rivera' : (role === 'faculty' ? 'Dr. Sarah Jenkins' : 'System Admin'),
    email: email,
    phone_number: "+1 (555) 234-5678",
    role: role,
    photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
    signature_url: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Jon_Kirsch_Signature.png",
    program: "B.Tech",
    department: "Computer Science & Engineering",
    branch: "AI/DS",
    current_semester: "Semester 4",
    hostel_details: "Hostel Y4, Room W310",
    mess_choice: "Central Mess Hall A",
    designation: "Associate Professor",
    additional_positions: "Head of Department",
    research_topics: "Machine Learning, Neural Network Optimization",
    education_history: "B.Tech (IIT), Ph.D. (Stanford)"
  };

  document.getElementById('loginContainer').classList.add('hidden');
  document.getElementById('userHeaderNav').classList.remove('hidden');
  document.getElementById('navUserBadge').innerText = `${window.currentUser.name} (${role.toUpperCase()})`;
  document.getElementById('portalWorkspace').classList.remove('hidden');

  renderProfileView(window.currentUser, 'portalWorkspace');
}

function handleLogout() {
  window.currentUser = null;
  document.getElementById('portalWorkspace').classList.add('hidden');
  document.getElementById('userHeaderNav').classList.add('hidden');
  document.getElementById('loginContainer').classList.remove('hidden');
}