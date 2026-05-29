// Giza Land Admin Dashboard Logic
let allAdminProperties = [];
let activeSection = 'stats';
let adminMap = null;
let adminMarker = null;
let adminUploadedImages = [];

// Auth Monitor
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        // Display admin name
        document.getElementById('adminWelcomeTitle').innerHTML = `مرحباً، ${user.displayName || 'مدير الموقع'}`;
        // Hide loader overlay
        document.getElementById('auth-overlay').style.display = 'none';
        initAdminDashboard();
    }
});

// Set current date
document.getElementById('currentDate').innerText = new Date().toLocaleDateString('ar-EG', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
});

// Toggle Sidebar on mobile
window.toggleAdminSidebar = function() {
    document.getElementById('adminSidebar').classList.toggle('open');
};

// Main Dashboard Initialization
async function initAdminDashboard() {
    loadFormDropdowns();
    await fetchAllAdminProperties();
}

// Load categories & locations in the form from config
function loadFormDropdowns() {
    const catSelect = document.getElementById('adCategory');
    const locSelect = document.getElementById('adLocation');
    
    if (catSelect && locSelect) {
        catSelect.innerHTML = '';
        locSelect.innerHTML = '';
        
        GIZA_CONFIG.categories.ar.forEach(cat => {
            catSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
        
        GIZA_CONFIG.locations.ar.forEach(loc => {
            locSelect.innerHTML += `<option value="${loc.id}">${loc.name}</option>`;
        });
    }
}

// Switch Sections
window.showAdminSection = function(secId) {
    activeSection = secId;
    
    // Switch active buttons styling
    const btns = ['Stats', 'Active', 'Pending', 'Add'];
    btns.forEach(b => {
        const el = document.getElementById(`btnSec${b}`);
        if (el) el.classList.toggle('active', b.toLowerCase() === secId.toLowerCase());
    });

    // Switch active section visibility
    const sections = ['stats', 'active', 'pending', 'add'];
    sections.forEach(s => {
        const el = document.getElementById(`sec-${s}`);
        if (el) el.classList.toggle('active', s === secId);
    });

    // Close sidebar on mobile after selection
    document.getElementById('adminSidebar').classList.remove('open');
};

// Fetch All Properties (Active and Pending)
async function fetchAllAdminProperties() {
    try {
        const snap = await db.collection('properties')
            .orderBy('createdAt', 'desc')
            .get();

        allAdminProperties = [];
        snap.forEach(doc => {
            allAdminProperties.push({ id: doc.id, ...doc.data() });
        });

        calculateStats();
        renderActiveTable();
        renderPendingTable();
    } catch (e) {
        console.error("Error loading admin properties:", e);
        showToast("فشل تحميل البيانات من السيرفر.", "error");
    }
}

// Calculate Statistics Cards values
function calculateStats() {
    const activeList = allAdminProperties.filter(p => p.status === 'active');
    const pendingList = allAdminProperties.filter(p => p.status === 'pending');
    const saleList = activeList.filter(p => p.type === 'sale');
    const rentList = activeList.filter(p => p.type === 'rent');

    document.getElementById('statTotalActive').innerText = activeList.length;
    document.getElementById('statTotalPending').innerText = pendingList.length;
    document.getElementById('statTotalSale').innerText = saleList.length;
    document.getElementById('statTotalRent').innerText = rentList.length;

    // Set badge number on sidebar
    const badge = document.getElementById('pendingBadge');
    if (badge) {
        if (pendingList.length > 0) {
            badge.innerText = pendingList.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Render Active Properties Table
function renderActiveTable() {
    const tbody = document.getElementById('activeTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const activeList = allAdminProperties.filter(p => p.status === 'active');

    if (activeList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">لا توجد عقارات نشطة معروضة حالياً.</td></tr>`;
        return;
    }

    activeList.forEach(p => {
        const locObj = GIZA_CONFIG.locations.ar.find(l => l.id === p.location);
        const catObj = GIZA_CONFIG.categories.ar.find(c => c.id === p.category);
        const locName = locObj ? locObj.name : p.location;
        const catName = catObj ? catObj.name : p.category;
        
        const dealType = p.type === 'sale' ? 'للبيع' : 'للإيجار';
        const dealClass = p.type === 'sale' ? 'active' : 'pending'; // visually distinct badge styles

        const mainImg = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '1.jpg';

        tbody.innerHTML += `
            <tr>
                <td><img src="${mainImg}" class="table-img"></td>
                <td style="font-weight:800; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.title}">${p.title}</td>
                <td>${locName}</td>
                <td>${catName}</td>
                <td><span class="status-badge ${dealClass}">${dealType}</span></td>
                <td style="color:var(--accent); font-weight:800;">${Number(p.price).toLocaleString()} ج.م</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-table-action edit" onclick="editProperty('${p.id}')"><i class="fa fa-edit"></i> تعديل</button>
                        <button class="btn-table-action reject" onclick="deleteProperty('${p.id}')"><i class="fa fa-trash"></i> حذف</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// Render Pending Properties Table (Approvals)
function renderPendingTable() {
    const tbody = document.getElementById('pendingTableBody');
    const quickTbody = document.getElementById('quickPendingTableBody');
    
    if (!tbody || !quickTbody) return;

    tbody.innerHTML = '';
    quickTbody.innerHTML = '';
    
    const pendingList = allAdminProperties.filter(p => p.status === 'pending');

    if (pendingList.length === 0) {
        const emptyMsg = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">لا توجد طلبات معلقة بانتظار المراجعة. ممتاز!</td></tr>`;
        tbody.innerHTML = emptyMsg;
        quickTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">لا توجد طلبات معلقة بانتظار المراجعة. ممتاز!</td></tr>`;
        return;
    }

    pendingList.forEach(p => {
        const locObj = GIZA_CONFIG.locations.ar.find(l => l.id === p.location);
        const locName = locObj ? locObj.name : p.location;
        const mainImg = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '1.jpg';

        const rowHtml = `
            <tr>
                <td><img src="${mainImg}" class="table-img"></td>
                <td style="font-weight:800; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.title}">${p.title}</td>
                <td>${locName}</td>
                <td style="color:var(--accent); font-weight:800;">${Number(p.price).toLocaleString()} ج.م</td>
                <td>${p.contactName}</td>
                <td><a href="https://wa.me/${p.contactPhone}" target="_blank" style="color:var(--whatsapp); text-decoration:none; font-weight:800;"><i class="fa-brands fa-whatsapp"></i> ${p.contactPhone}</a></td>
                <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.description}">${p.description}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-table-action approve" onclick="approveProperty('${p.id}')"><i class="fa fa-check"></i> موافقة</button>
                        <button class="btn-table-action reject" onclick="deleteProperty('${p.id}')"><i class="fa fa-times"></i> رفض</button>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML += rowHtml;

        // Render top 3 in quick dashboard view
        quickTbody.innerHTML += `
            <tr>
                <td><img src="${mainImg}" class="table-img"></td>
                <td style="font-weight:800; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.title}</td>
                <td>${locName}</td>
                <td style="color:var(--accent); font-weight:800;">${Number(p.price).toLocaleString()} ج.م</td>
                <td>${p.contactName}</td>
                <td><a href="https://wa.me/${p.contactPhone}" target="_blank" style="color:var(--whatsapp);"><i class="fa-brands fa-whatsapp"></i> تواصل</a></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-table-action approve" style="padding:4px 8px; font-size:11px;" onclick="approveProperty('${p.id}')"><i class="fa fa-check"></i> موافقة</button>
                        <button class="btn-table-action reject" style="padding:4px 8px; font-size:11px;" onclick="deleteProperty('${p.id}')"><i class="fa fa-times"></i> رفض</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// Approve Pending Property Listing
window.approveProperty = async function(id) {
    try {
        await db.collection('properties').doc(id).update({
            status: 'active',
            approvedAt: new Date().toISOString()
        });
        showToast("تمت الموافقة على نشر العقار بنجاح! ✅");
        await fetchAllAdminProperties();
    } catch (e) {
        console.error("Approve error:", e);
        showToast("فشل تفعيل العقار.", "error");
    }
};

// Delete/Reject Property Listing
window.deleteProperty = async function(id) {
    if (!confirm("هل أنت متأكد من حذف أو رفض هذا العقار نهائياً؟")) return;
    
    try {
        await db.collection('properties').doc(id).delete();
        showToast("تم حذف العقار بالكامل من السيرفر. 🗑️");
        await fetchAllAdminProperties();
    } catch (e) {
        console.error("Delete error:", e);
        showToast("فشل حذف العقار.", "error");
    }
};

// ─── Add/Edit Form Logic ───
window.openAddAdminForm = function() {
    document.getElementById('formSectionTitle').innerText = "إضافة عقار جديد مباشرة للموقع";
    document.getElementById('btnAdminFormSubmit').innerText = "نشر العقار فوراً";
    document.getElementById('adminPropertyForm').reset();
    document.getElementById('editPropertyId').value = '';
    document.getElementById('adLat').value = '';
    document.getElementById('adLng').value = '';
    document.getElementById('adImagePreviews').innerHTML = '';
    adminUploadedImages = [];
    
    showAdminSection('add');
    initAdminMap(GIZA_CONFIG.mapCenter);
};

// Edit Property setup
window.editProperty = function(id) {
    const p = allAdminProperties.find(item => item.id === id);
    if (!p) return;

    document.getElementById('formSectionTitle').innerText = "تعديل بيانات العقار المنشور";
    document.getElementById('btnAdminFormSubmit').innerText = "حفظ التعديلات";
    document.getElementById('editPropertyId').value = p.id;

    // Prefill inputs
    document.getElementById('adContactName').value = p.contactName || '';
    document.getElementById('adContactPhone').value = p.contactPhone || '';
    document.getElementById('adTitle').value = p.title || '';
    document.getElementById('adType').value = p.type || 'sale';
    document.getElementById('adCategory').value = p.category || '';
    document.getElementById('adLocation').value = p.location || '';
    document.getElementById('adPrice').value = p.price || '';
    document.getElementById('adArea').value = p.area || '';
    document.getElementById('adBeds').value = p.beds || '';
    document.getElementById('adBaths').value = p.baths || '';
    document.getElementById('adDescription').value = p.description || '';
    
    // Lat / Lng
    document.getElementById('adLat').value = p.lat || '';
    document.getElementById('adLng').value = p.lng || '';

    // Render existing thumbnails
    adminUploadedImages = p.images || [];
    const container = document.getElementById('adImagePreviews');
    container.innerHTML = '';
    adminUploadedImages.forEach((imgUrl, idx) => {
        const thumbId = 'adthumb-' + idx;
        container.innerHTML += `
            <div class="preview-thumb" id="${thumbId}">
                <img src="${imgUrl}" />
                <button type="button" class="remove-thumb" onclick="removeAdminUploadedImage('${imgUrl}', '${thumbId}')">&times;</button>
            </div>
        `;
    });

    showAdminSection('add');
    initAdminMap([p.lat || GIZA_CONFIG.mapCenter[0], p.lng || GIZA_CONFIG.mapCenter[1]]);
    if (p.lat && p.lng) {
        setAdminLocationPin(p.lat, p.lng);
    }
};

// Initialize Map in Add/Edit Form
function initAdminMap(center) {
    // Delay slightly to allow container to render
    setTimeout(() => {
        if (!adminMap) {
            adminMap = L.map('admin-modal-map').setView(center, GIZA_CONFIG.zoom);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(adminMap);
            
            adminMap.on('click', function(e) {
                setAdminLocationPin(e.latlng.lat, e.latlng.lng);
            });
        } else {
            adminMap.invalidateSize();
            adminMap.setView(center, GIZA_CONFIG.zoom);
            if (adminMarker) {
                adminMap.removeLayer(adminMarker);
                adminMarker = null;
            }
        }
    }, 250);
}

// Set location pin in Admin Map Selector
function setAdminLocationPin(lat, lng) {
    document.getElementById('adLat').value = lat;
    document.getElementById('adLng').value = lng;

    const dotIcon = L.divIcon({ className: 'red-dot', iconSize: [14, 14] });
    if (adminMarker) {
        adminMarker.setLatLng([lat, lng]);
    } else {
        adminMarker = L.marker([lat, lng], { icon: dotIcon, draggable: true }).addTo(adminMap);
        adminMarker.on('dragend', function() {
            const pos = adminMarker.getLatLng();
            document.getElementById('adLat').value = pos.lat;
            document.getElementById('adLng').value = pos.lng;
        });
    }
}

// Handle Admin Multi-Image upload via ImgBB
window.handleAdminImageSelection = async function(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const container = document.getElementById('adImagePreviews');
    
    for (const file of files) {
        const thumbId = 'adthumb-' + Math.random().toString(36).substring(2, 9);
        const thumb = document.createElement('div');
        thumb.className = 'preview-thumb';
        thumb.id = thumbId;
        thumb.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.05);">
                <div class="spinner" style="border-color:rgba(0,0,0,0.1); border-top-color:var(--accent);"></div>
            </div>
        `;
        container.appendChild(thumb);

        try {
            const fd = new FormData();
            fd.append('image', file);
            
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${GIZA_CONFIG.imgbbKey}`, { 
                method: 'POST', 
                body: fd 
            });
            const data = await res.json();

            if (data.success) {
                const url = data.data.display_url;
                adminUploadedImages.push(url);
                
                thumb.innerHTML = `
                    <img src="${url}" />
                    <button type="button" class="remove-thumb" onclick="removeAdminUploadedImage('${url}', '${thumbId}')">&times;</button>
                `;
                showToast("تم رفع الصورة بنجاح!");
            } else {
                throw new Error("ImgBB fail");
            }
        } catch (err) {
            console.error("Upload error:", err);
            thumb.remove();
            showToast("فشل رفع الصورة لمتصفح الصور.", "error");
        }
    }
};

window.removeAdminUploadedImage = function(url, thumbId) {
    adminUploadedImages = adminUploadedImages.filter(u => u !== url);
    const thumb = document.getElementById(thumbId);
    if (thumb) thumb.remove();
};

// Form Submit: Add or Update Property
window.submitAdminForm = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnAdminFormSubmit');
    const editId = document.getElementById('editPropertyId').value;
    
    const lat = document.getElementById('adLat').value;
    const lng = document.getElementById('adLng').value;

    if (!lat || !lng) {
        alert("برجاء النقر على الخريطة لتحديد موقع العقار الجغرافي");
        return;
    }

    if (adminUploadedImages.length === 0) {
        alert("برجاء رفع صورة واحدة على الأقل للعقار");
        return;
    }

    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = `<div class="spinner"></div> جاري النشر...`;

    const propData = {
        contactName:  document.getElementById('adContactName').value.trim(),
        contactPhone: document.getElementById('adContactPhone').value.trim(),
        title:        document.getElementById('adTitle').value.trim(),
        type:         document.getElementById('adType').value,
        category:     document.getElementById('adCategory').value,
        location:     document.getElementById('adLocation').value,
        price:        parseFloat(document.getElementById('adPrice').value),
        area:         parseFloat(document.getElementById('adArea').value),
        beds:         parseInt(document.getElementById('adBeds').value),
        baths:        parseInt(document.getElementById('adBaths').value),
        description:  document.getElementById('adDescription').value.trim(),
        images:       adminUploadedImages,
        lat:          parseFloat(lat),
        lng:          parseFloat(lng),
        status:       'active', // Direct Admin uploads are active immediately
        updatedAt:    new Date().toISOString()
    };

    try {
        if (editId) {
            // Edit existing listing
            await db.collection('properties').doc(editId).update(propData);
            showToast("تم تحديث بيانات العقار بنجاح! 💾");
        } else {
            // Add new listing
            propData.createdAt = new Date().toISOString();
            await db.collection('properties').add(propData);
            showToast("تم نشر العقار الجديد بنجاح! 🚀");
        }
        
        // Reset and refresh
        showAdminSection('stats');
        await fetchAllAdminProperties();
    } catch (err) {
        console.error("Save error:", err);
        showToast("حدث خطأ أثناء حفظ البيانات.", "error");
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = editId ? "حفظ التعديلات" : "نشر العقار فوراً";
    }
};

// Handle Admin Logout
window.handleAdminLogout = async function() {
    if (!confirm("هل أنت متأكد من تسجيل الخروج من لوحة التحكم؟")) return;
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (e) {
        showToast("فشل تسجيل الخروج.", "error");
    }
};

// Show Toast
function showToast(msg, type = 'success') {
    let container = document.getElementById('toasts');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toasts';
        document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = msg;
    container.appendChild(t);
    setTimeout(() => {
        t.remove();
    }, 4000);
}
