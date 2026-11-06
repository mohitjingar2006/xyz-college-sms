/**
 * MEMBER A: Shared User Profile Component Infrastructure
 * Generates uniform user profile cards and inline update forms
 * adhering strictly to Student, Faculty, and Admin schemas.
 */

// Global state container
window.currentUser = null;

// Renders the Profile Component into target container
function renderProfileView(user, containerId = 'portalWorkspace') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isStudent = user.role === 'student';
  const isFaculty = user.role === 'faculty';
  const isAdmin = user.role === 'admin';

  let roleSpecificDetailsHtml = '';

  if (isStudent) {
    roleSpecificDetailsHtml = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded border">
        <div><span class="text-xs text-slate-500 font-semibold block">DEGREE PROGRAM</span><span class="font-medium">${user.program || 'B.Tech'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">DEPARTMENT</span><span class="font-medium">${user.department || 'Computer Science & Engineering'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">SPECIALIZED BRANCH</span><span class="font-medium">${user.branch || 'AI / Data Science'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">CURRENT SEMESTER</span><span class="font-medium">${user.current_semester || 'Semester 4'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">HOSTEL ALLOCATION</span><span class="font-medium">${user.hostel_details || 'Hostel Y4, Room W310'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">MESS OPTION</span><span class="font-medium">${user.mess_choice || 'Central Mess Hall A'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">PARENT CONTACT</span><span class="font-medium">${user.parent_phone_number || 'N/A'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">GUARDIAN CONTACT</span><span class="font-medium">${user.guardian_phone_number || 'N/A'}</span></div>
        <div class="md:col-span-2"><span class="text-xs text-slate-500 font-semibold block">PERMANENT ADDRESS</span><span class="font-medium">${user.home_address || 'N/A'}</span></div>
      </div>
    `;
  } else if (isFaculty) {
    roleSpecificDetailsHtml = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded border">
        <div><span class="text-xs text-slate-500 font-semibold block">DEPARTMENT</span><span class="font-medium">${user.department || 'Computer Science & Engineering'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">ACADEMIC DESIGNATION</span><span class="font-medium">${user.designation || 'Assistant Professor'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">ADDITIONAL ADMINISTRATIVE POST</span><span class="font-medium">${user.additional_positions || 'None'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">EDUCATION HISTORY</span><span class="font-medium">${user.education_history || 'Ph.D. Computer Science'}</span></div>
        <div class="md:col-span-2"><span class="text-xs text-slate-500 font-semibold block">RESEARCH FOCUS AREAS</span><span class="font-medium">${user.research_topics || 'Distributed Systems, Machine Learning'}</span></div>
      </div>
    `;
  } else if (isAdmin) {
    roleSpecificDetailsHtml = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded border">
        <div><span class="text-xs text-slate-500 font-semibold block">ADMINISTRATIVE TITLE</span><span class="font-medium">${user.role_title || 'System Administrator'}</span></div>
        <div><span class="text-xs text-slate-500 font-semibold block">ACCESS LEVEL</span><span class="font-medium text-emerald-700 font-bold">Full Control (Superuser)</span></div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="academic-card">
      <div class="academic-card-header flex justify-between items-center">
        <h2 class="academic-card-title">User Account Profile</h2>
        <button onclick="toggleProfileEditForm()" class="btn-primary text-sm">Edit Profile</button>
      </div>

      <!-- Overview Section -->
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b">
        <div class="text-center">
          <img src="${user.photo_url || 'https://via.placeholder.com/96?text=User'}" alt="User Avatar" id="displayUserPhoto" class="preview-avatar mb-2">
          <span class="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-semibold capitalize">${user.role}</span>
        </div>
        <div class="flex-1 text-center sm:text-left">
          <h3 class="text-xl font-bold text-slate-800">${user.name}</h3>
          <p class="text-sm text-slate-500">${user.email}</p>
          <p class="text-sm text-slate-500">Phone: ${user.phone_number || 'Not provided'}</p>
          <div class="mt-3">
            <span class="text-xs text-slate-400 block font-semibold">DIGITAL SIGNATURE PREVIEW</span>
            <img src="${user.signature_url || 'https://via.placeholder.com/180x50?text=Signature+On+File'}" alt="Digital Signature" id="displayUserSignature" class="preview-signature mt-1">
          </div>
        </div>
      </div>

      <!-- Role Details -->
      ${roleSpecificDetailsHtml}

      <!-- Editable Profile Form Modal / Inline Panel -->
      <div id="profileEditFormPanel" class="hidden mt-6 pt-6 border-t border-dashed border-slate-300">
        <h3 class="font-serif font-bold text-lg mb-4" style="color: var(--primary-navy);">Update Contact & Personal Info</h3>
        <form id="userProfileForm" onsubmit="saveProfileChanges(event)">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="editName" class="form-input" value="${user.name || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="text" id="editPhone" class="form-input" value="${user.phone_number || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Profile Image URL</label>
              <input type="url" id="editPhotoUrl" class="form-input" value="${user.photo_url || ''}" oninput="previewImage('editPhotoUrl', 'photoPreview')">
              <img id="photoPreview" src="${user.photo_url || ''}" class="preview-avatar mt-2 hidden">
            </div>
            <div class="form-group">
              <label class="form-label">Signature Image URL</label>
              <input type="url" id="editSignatureUrl" class="form-input" value="${user.signature_url || ''}" oninput="previewImage('editSignatureUrl', 'sigPreview')">
              <img id="sigPreview" src="${user.signature_url || ''}" class="preview-signature mt-2 hidden">
            </div>

            ${isStudent ? `
              <div class="form-group md:col-span-2">
                <label class="form-label">Home Address</label>
                <textarea id="editAddress" class="form-textarea" rows="2">${user.home_address || ''}</textarea>
              </div>
            ` : ''}

            ${isFaculty ? `
              <div class="form-group md:col-span-2">
                <label class="form-label">Research Topics</label>
                <textarea id="editResearch" class="form-textarea" rows="2">${user.research_topics || ''}</textarea>
              </div>
            ` : ''}
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <button type="button" onclick="toggleProfileEditForm()" class="btn-outline">Cancel</button>
            <button type="submit" class="btn-primary">Save Profile Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Live Image URL Preview helper
function previewImage(inputId, previewImgId) {
  const url = document.getElementById(inputId).value;
  const imgEl = document.getElementById(previewImgId);
  if (url && imgEl) {
    imgEl.src = url;
    imgEl.classList.remove('hidden');
  }
}

// Toggle edit panel visibility
function toggleProfileEditForm() {
  const panel = document.getElementById('profileEditFormPanel');
  if (panel) panel.classList.toggle('hidden');
}

// Save profile form modifications to Supabase
async function saveProfileChanges(event) {
  event.preventDefault();
  
  if (!window.currentUser) {
    alert("Error: User session not found.");
    return;
  }

  const btn = event.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving to Database...';

  try {
    // 1. Gather form fields
    const fieldsToUpdate = {
      name: document.getElementById('editName').value,
      phone_number: document.getElementById('editPhone').value
    };

    const updatedPhoto = document.getElementById('editPhotoUrl').value;
    const updatedSig = document.getElementById('editSignatureUrl').value;
    if (updatedPhoto) fieldsToUpdate.photo_url = updatedPhoto;
    if (updatedSig) fieldsToUpdate.signature_url = updatedSig;

    if (window.currentUser.role === 'student') {
      const editAddr = document.getElementById('editAddress');
      if (editAddr) fieldsToUpdate.home_address = editAddr.value;
    } else if (window.currentUser.role === 'faculty') {
      const editRes = document.getElementById('editResearch');
      if (editRes) fieldsToUpdate.research_topics = editRes.value;
    }

    // 2. Push to Supabase Database (Member C's API)
    if (typeof window.updateOwnProfile === 'function') {
      await window.updateOwnProfile(window.currentUser.role, fieldsToUpdate);
    } else {
      throw new Error("Database connection missing. Ensure supabaseClient.js is loaded.");
    }

    // 3. Update local UI state
    Object.assign(window.currentUser, fieldsToUpdate);
    
    // 4. Also update the Navbar Header name
    const headerInfo = document.getElementById('header-user-info');
    if (headerInfo) {
      const title = window.currentUser.role === 'student' ? window.currentUser.id : window.currentUser.designation;
      headerInfo.textContent = `${window.currentUser.name} (${title})`;
    }

    alert('Profile updated successfully!');
    renderProfileView(window.currentUser, 'profile-container');
    
  } catch (error) {
    alert('Failed to update profile: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}