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
    await fetchAllAdminReviews();
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
    
    // Initialize custom selects in Admin
    createCustomSelect('adType');
    createCustomSelect('adCategory');
    createCustomSelect('adLocation');
}

// Switch Sections
window.showAdminSection = function(secId) {
    activeSection = secId;
    
    // Switch active buttons styling
    const btns = ['Stats', 'Active', 'Pending', 'Add', 'Reviews'];
    btns.forEach(b => {
        const el = document.getElementById(`btnSec${b}`);
        if (el) el.classList.toggle('active', b.toLowerCase() === secId.toLowerCase());
    });

    // Switch active section visibility
    const sections = ['stats', 'active', 'pending', 'add', 'reviews'];
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

        const mainImg = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : 'images/1.jpg';

        tbody.innerHTML += `
            <tr>
                <td><img src="${mainImg}" class="table-img"></td>
                <td style="font-weight:800; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.title}">${p.title}</td>
                <td>${locName}</td>
                <td>${catName}</td>
                <td><span class="status-badge ${dealClass}">${dealType}</span></td>
                <td style="color:var(--accent-gold); font-weight:800;">${Number(p.price).toLocaleString()} ج.م</td>
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
        const mainImg = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : 'images/1.jpg';

        const rowHtml = `
            <tr>
                <td><img src="${mainImg}" class="table-img"></td>
                <td style="font-weight:800; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.title}">${p.title}</td>
                <td>${locName}</td>
                <td style="color:var(--accent-gold); font-weight:800;">${Number(p.price).toLocaleString()} ج.م</td>
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
                <td style="color:var(--accent-gold); font-weight:800;">${Number(p.price).toLocaleString()} ج.م</td>
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
    
    // Sync custom selects
    createCustomSelect('adType');
    createCustomSelect('adCategory');
    createCustomSelect('adLocation');
    
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
    
    // Sync custom selects
    createCustomSelect('adType');
    createCustomSelect('adCategory');
    createCustomSelect('adLocation');
    
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
            adminMap = L.map('admin-modal-map', { attributionControl: false }).setView(center, GIZA_CONFIG.zoom);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(adminMap);
            
            adminMap.on('click', function(e) {
                setAdminLocationPin(e.latlng.lat, e.latlng.lng);
            });
            
            // Add Geocoder Search Control to the top-right of admin map
            L.Control.geocoder({
                defaultMarkGeocode: false,
                placeholder: 'ابحث عن منطقة...',
                position: 'topright'
            })
            .on('markgeocode', function(e) {
                const centerLoc = e.geocode.center;
                adminMap.setView(centerLoc, 15);
                setAdminLocationPin(centerLoc.lat, centerLoc.lng);
            })
            .addTo(adminMap);
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
                <div class="spinner" style="border-color:rgba(0,0,0,0.1); border-top-color:var(--accent-cyan);"></div>
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

// Vanilla JS Custom Select Dropdown helper for Admin Page
function createCustomSelect(selectId, placeholderStr = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Check if already initialized and remove wrapper to recreate it fresh
    const existingWrapper = select.parentElement.querySelector('.custom-select-wrapper');
    if (existingWrapper) {
        existingWrapper.remove();
    }
    
    // Hide native select
    select.style.display = 'none';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.innerHTML = `
        <span class="select-trigger-text"></span>
        <i class="fa fa-chevron-down select-chevron"></i>
    `;
    
    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'select-search-box';
    searchContainer.innerHTML = `
        <i class="fa fa-search search-icon"></i>
        <input type="text" placeholder="بحث...">
    `;
    
    const list = document.createElement('ul');
    list.className = 'select-options-list';
    
    dropdown.appendChild(searchContainer);
    dropdown.appendChild(list);
    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
    
    select.parentElement.appendChild(wrapper);
    
    // Populate options list
    function updateOptions() {
        list.innerHTML = '';
        const searchVal = searchContainer.querySelector('input').value.toLowerCase();
        
        Array.from(select.options).forEach(opt => {
            if (opt.text.toLowerCase().includes(searchVal)) {
                const li = document.createElement('li');
                li.className = 'select-option-item';
                if (opt.selected) {
                    li.classList.add('selected');
                    trigger.querySelector('.select-trigger-text').innerText = opt.text;
                }
                li.innerText = opt.text;
                li.onclick = function(e) {
                    e.stopPropagation();
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change'));
                    updateOptions();
                    wrapper.classList.remove('open');
                };
                list.appendChild(li);
            }
        });
    }
    
    // Event listeners
    trigger.onclick = function(e) {
        e.stopPropagation();
        // Close all other custom selects first
        document.querySelectorAll('.custom-select-wrapper').forEach(w => {
            if (w !== wrapper) w.classList.remove('open');
        });
        wrapper.classList.toggle('open');
        if (wrapper.classList.contains('open')) {
            searchContainer.querySelector('input').focus();
        }
    };
    
    searchContainer.querySelector('input').oninput = function() {
        updateOptions();
    };
    
    searchContainer.querySelector('input').onclick = function(e) {
        e.stopPropagation();
    };
    
    // Initial populate
    updateOptions();
}

// Global click listener to close custom select dropdowns when clicking outside
document.addEventListener('click', function() {
    document.querySelectorAll('.custom-select-wrapper').forEach(w => {
        w.classList.remove('open');
    });
});

// Seed sample properties directly from Admin Panel
window.seedSamplePropertiesFromAdmin = async function() {
    if (!confirm("هل تريد توليد 12 عقاراً تجريبياً نشطاً (شقق، فلل، مكاتب، محلات، إلخ) لعرضها فوراً في الموقع؟")) return;
    
    // Disable button to prevent double-clicks
    const btn = document.querySelector('[onclick="seedSamplePropertiesFromAdmin()"]');
    let originalText = "";
    if (btn) {
        originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> جاري توليد البيانات...`;
    }
    
    const mockProps = [
        {
            title: "شقة فاخرة للبيع في حدائق الأهرام",
            contactName: "مكتب البستان العقاري",
            contactPhone: "201113453475",
            type: "sale",
            category: "apartment",
            location: "hadayek_ahram",
            price: 2600000,
            area: 175,
            beds: 3,
            baths: 2,
            description: "شقة سوبر لوكس واجهة ممتازة في البوابة الثانية حدائق الأهرام، قريبة من الخدمات والمدرسة الأوربية.",
            images: [
                "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop"
            ],
            lat: 29.9863,
            lng: 31.1124,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "فيلا مستقلة رائعة مع مسبح خاص بالشيخ زايد",
            contactName: "زايد هومز",
            contactPhone: "201113453475",
            type: "sale",
            category: "villa",
            location: "sheikh_zayed",
            price: 11500000,
            area: 420,
            beds: 5,
            baths: 4,
            description: "فيلا مستقلة تشطيب ألترا سوبر لوكس مع حديقة ومسبح خاص في أرقى كمبوند بالشيخ زايد.",
            images: [
                "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&auto=format&fit=crop"
            ],
            lat: 30.0468,
            lng: 30.9739,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "مكتب إداري مجهز بالكامل للإيجار بالمهندسين",
            contactName: "جيزة بيزنس",
            contactPhone: "201113453475",
            type: "rent",
            category: "office",
            location: "mohandessin",
            price: 35000,
            area: 110,
            beds: 0,
            baths: 1,
            description: "مكتب إداري متشطب ومكيف بالكامل يطل على شارع جامعة الدول العربية مباشرة.",
            images: [
                "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&auto=format&fit=crop"
            ],
            lat: 30.0614,
            lng: 31.2012,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "شقة للإيجار قانون جديد في الدقي",
            contactName: "إيليت بروبرتيز",
            contactPhone: "201113453475",
            type: "rent",
            category: "apartment",
            location: "dokki",
            price: 18000,
            area: 140,
            beds: 2,
            baths: 2,
            description: "شقة للإيجار المفروش أو قانون جديد، دور متوسط، مصعد شغال، قريبة من مترو الدقي.",
            images: [
                "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop"
            ],
            lat: 30.0384,
            lng: 31.2114,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "محل تجاري للبيع موقع حيوي في الهرم",
            contactName: "الوكيل العقاري",
            contactPhone: "201113453475",
            type: "sale",
            category: "store",
            location: "haram",
            price: 5200000,
            area: 65,
            beds: 0,
            baths: 1,
            description: "محل تجاري واجهة عريضة على شارع الهرم الرئيسي، موقع ممتاز بجوار كبرى العلامات التجارية.",
            images: [
                "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&auto=format&fit=crop"
            ],
            lat: 30.0074,
            lng: 31.1712,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "تاون هاوس راقي للبيع في 6 أكتوبر",
            contactName: "أكتوبر إستيت",
            contactPhone: "201113453475",
            type: "sale",
            category: "townhouse",
            location: "october",
            price: 8900000,
            area: 260,
            beds: 4,
            baths: 3,
            description: "تاون هاوس للبيع بـ 6 أكتوبر بالتقسيط المريح، في كمبوند متكامل الخدمات مع أمن وحراسة.",
            images: [
                "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop"
            ],
            lat: 29.9723,
            lng: 30.9419,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "شقة بفيلا مميزة للإيجار في الشيخ زايد",
            contactName: "اليمامة للتسويق",
            contactPhone: "201113453475",
            type: "rent",
            category: "apartment",
            location: "sheikh_zayed",
            price: 22000,
            area: 180,
            beds: 3,
            baths: 3,
            description: "شقة داخل فيلا راقية بالحي الدبلوماسي بالشيخ زايد، قريبة من هايبر وان ومول العرب.",
            images: [
                "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=800&auto=format&fit=crop"
            ],
            lat: 30.0520,
            lng: 30.9810,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "محل تجاري للإيجار في شارع فيصل الرئيسي",
            contactName: "الوسيط العقاري",
            contactPhone: "201113453475",
            type: "rent",
            category: "store",
            location: "faisal",
            price: 25000,
            area: 80,
            beds: 0,
            baths: 1,
            description: "محل تجاري للإيجار متشطب وجاهز للتشغيل فوراً، موقع حيوي جداً في شارع فيصل الرئيسي.",
            images: [
                "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&auto=format&fit=crop"
            ],
            lat: 30.0120,
            lng: 31.1550,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "عمارة سكنية كاملة للبيع في الوراق",
            contactName: "مجموعة النيل للاستثمار",
            contactPhone: "201113453475",
            type: "sale",
            category: "building",
            location: "warraq",
            price: 14500000,
            area: 900,
            beds: 18,
            baths: 12,
            description: "عمارة سكنية للبيع بالكامل بالوراق، تتكون من 6 طوابق، تشطيب خارجي مميز ومدخل رخام.",
            images: [
                "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop"
            ],
            lat: 30.1150,
            lng: 31.2050,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "أرض فضاء تجارية مميزة للبيع في 6 أكتوبر",
            contactName: "أكتوبر لاند",
            contactPhone: "201113453475",
            type: "sale",
            category: "land",
            location: "october",
            price: 18000000,
            area: 1200,
            beds: 0,
            baths: 0,
            description: "أرض فضاء للبيع بترخيص تجاري/إداري مميز، موقع استراتيجي في التوسعات الشمالية بـ 6 أكتوبر.",
            images: [
                "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&auto=format&fit=crop"
            ],
            lat: 29.9550,
            lng: 30.9150,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "شقة كاملة المرافق للبيع في ميدان الجيزة",
            contactName: "وكيل جيزة لاند",
            contactPhone: "201113453475",
            type: "sale",
            category: "apartment",
            location: "giza_square",
            price: 3200000,
            area: 150,
            beds: 3,
            baths: 2,
            description: "شقة للبيع تشطيب كامل الترا سوبر لوكس، تطل على ميدان الجيزة الرئيسي وقريبة من المترو.",
            images: [
                "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop"
            ],
            lat: 30.0100,
            lng: 31.2120,
            status: "active",
            createdAt: new Date().toISOString()
        },
        {
            title: "مكتب إداري فاخر للبيع في الدقي",
            contactName: "الدقي هومز",
            contactPhone: "201113453475",
            type: "sale",
            category: "office",
            location: "dokki",
            price: 6800000,
            area: 95,
            beds: 0,
            baths: 1,
            description: "مكتب إداري للبيع بموقع حيوي جداً في الدقي، تشطيب كامل بالتكييفات والأثاث المكتبي الفاخر.",
            images: [
                "https://images.unsplash.com/photo-1497215842964-222b430db094?w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&auto=format&fit=crop"
            ],
            lat: 30.0350,
            lng: 31.2080,
            status: "active",
            createdAt: new Date().toISOString()
        }
    ];

    try {
        let count = 0;
        for (const prop of mockProps) {
            await db.collection('properties').add(prop);
            count++;
        }
        showToast(`تم توليد ${count} عقاراً تجريبياً بنجاح! 🚀`);
        await fetchAllAdminProperties();
        showAdminSection('stats');
    } catch (e) {
        console.error("Failed to seed:", e);
        showToast("حدث خطأ أثناء توليد العقارات التجريبية.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};



// ─── Customer Reviews Administration ───
let allAdminReviews = [];

async function fetchAllAdminReviews() {
    try {
        const snap = await db.collection('reviews')
            .orderBy('createdAt', 'desc')
            .get();
        
        allAdminReviews = [];
        snap.forEach(doc => {
            allAdminReviews.push({ id: doc.id, ...doc.data() });
        });
        
        renderReviewsTable();
    } catch (e) {
        console.error("Error loading reviews:", e);
    }
}

function renderReviewsTable() {
    const tbody = document.getElementById('reviewsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (allAdminReviews.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد تقييمات عملاء حالياً.</td></tr>`;
        return;
    }
    
    allAdminReviews.forEach(rev => {
        const ratingStars = '⭐'.repeat(rev.rating || 5);
        tbody.innerHTML += `
            <tr>
                <td style="font-weight:700;">${rev.name}</td>
                <td>${rev.location || 'غير محدد'}</td>
                <td style="color:var(--accent-gold);">${ratingStars}</td>
                <td style="max-width:300px; word-wrap:break-word; white-space:normal; line-height:1.5;">${rev.comment}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-table-action reject" onclick="deleteReview('${rev.id}')"><i class="fa fa-trash"></i> حذف التقييم</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.deleteReview = async function(id) {
    if (!confirm("هل أنت متأكد من حذف هذا التقييم نهائياً؟")) return;
    try {
        await db.collection('reviews').doc(id).delete();
        showToast("تم حذف التقييم بنجاح! 🗑️");
        await fetchAllAdminReviews();
    } catch (e) {
        console.error("Delete review error:", e);
        showToast("فشل حذف التقييم.", "error");
    }
};
