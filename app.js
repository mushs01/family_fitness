// 전역 변수
let currentProfile = null;
let exercisePlan = [];
let currentDate = new Date();
let selectedPlan = null;

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyAlQzTfxwrlCqB0K700wjt-y7jkLlwzTbY",
    authDomain: "family-fitness-app.firebaseapp.com",
    projectId: "family-fitness-app",
    storageBucket: "family-fitness-app.firebasestorage.app",
    messagingSenderId: "780285798866",
    appId: "1:780285798866:web:22164aee6f3e600166800b",
    measurementId: "G-CQX45MBMCF"
};

// Firebase 초기화
let db = null;
let isFirebaseAvailable = false;
const FAMILY_CODE = "OUR_FAMILY_2024";

// Firebase 초기화 시도
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    isFirebaseAvailable = true;
    console.log("🔥 Firebase 연결 성공!");
} catch (error) {
    console.warn("⚠️ Firebase 연결 실패, 로컬 모드로 동작:", error);
    isFirebaseAvailable = false;
}

// 로컬 스토리지 키
const STORAGE_KEY = 'family_fitness_data';

// 초기화
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
});

// 앱 초기화
async function initializeApp() {
    // 로딩 화면 표시
    showScreen('loading-screen');
    
    // 로딩 상태 업데이트
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = 'Firebase 연결 중...';
    }
    
    // 데이터 로드
    await loadData();
    
    // Firebase 실시간 동기화 설정
    setupFirebaseSync();
    
    // 로딩 상태 최종 업데이트
    if (loadingText) {
        if (isFirebaseAvailable) {
            loadingText.textContent = '🔥 가족 공유 모드 준비 완료!';
        } else {
            loadingText.textContent = '📱 로컬 모드로 시작합니다.';
        }
    }
    
    // 3초 후 프로필 선택 화면으로 이동
    setTimeout(async () => {
        showScreen('profile-screen');
        await updateRanking();
        await updateProfileCards();
    }, 3000);
    
    setupEventListeners();
}

// Firebase 실시간 동기화 설정
function setupFirebaseSync() {
    if (!isFirebaseAvailable) {
        console.log("📱 로컬 모드로 동작");
        return;
    }
    
    // Firestore 실시간 리스너 설정
    db.collection('families').doc(FAMILY_CODE)
        .onSnapshot(async (doc) => {
            if (doc.exists && doc.metadata.hasPendingWrites === false) {
                console.log("🔄 Firebase에서 실시간 데이터 수신");
                const data = doc.data();
                
                // 로컬 저장소에도 동기화
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                
                // 현재 프로필이 있으면 UI 업데이트
                if (currentProfile) {
                    await updatePlansList();
                    await updateRanking();
                } else {
                    // 프로필 선택 화면에 있을 때도 업데이트
                    await updateRanking();
                    await updateProfileCards();
                }
                
                showMessage("🔄 가족 데이터가 동기화되었습니다!");
            }
        }, (error) => {
            console.warn("⚠️ Firebase 실시간 동기화 오류:", error);
        });
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 프로필 카드 클릭
    document.querySelectorAll('.profile-card').forEach(card => {
        card.addEventListener('click', async function() {
            const profile = this.dataset.profile;
            await selectProfile(profile);
        });
    });
    
    // 기본 설정 버튼
    document.querySelectorAll('.set-default-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const profile = this.closest('.profile-card').dataset.profile;
            setDefaultProfile(profile);
        });
    });
    
    // 뒤로 가기 버튼
    document.querySelector('.back-btn').addEventListener('click', async function() {
        showScreen('profile-screen');
        await updateRanking();
        await updateProfileCards();
    });
    
    // 탭 버튼 클릭 이벤트
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const tabName = this.dataset.tab;
            await switchTab(tabName);
        });
    });
    
    // 캘린더 네비게이션 버튼
    document.querySelectorAll('.calendar-nav').forEach(btn => {
        btn.addEventListener('click', async function() {
            await navigateMonth(this.dataset.nav);
        });
    });
    
    // 새 계획 추가 버튼
    document.querySelector('.add-plan-btn').addEventListener('click', function() {
        showAddPlanPopup();
    });
    
    // 팝업 닫기
    document.querySelector('.cancel-btn').addEventListener('click', function() {
        hideAddPlanPopup();
    });
    
    // 계획 저장
    document.getElementById('plan-form').addEventListener('submit', function(e) {
        e.preventDefault();
        savePlan();
    });
    
    // 캘린더 네비게이션
    document.querySelectorAll('.calendar-nav').forEach(btn => {
        btn.addEventListener('click', function() {
            const direction = this.dataset.nav;
            navigateCalendar(direction);
        });
    });
    
    // 앱 종료 버튼
    document.querySelector('.exit-btn').addEventListener('click', function() {
        if (confirm('정말로 앱을 종료하시겠습니까?')) {
            window.close();
        }
    });
    
    // 앱 정보 버튼
    document.querySelector('.info-btn').addEventListener('click', function() {
        showAppInfo();
    });
}

// 화면 전환
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// 프로필 선택
async function selectProfile(profileName) {
    currentProfile = profileName;
    
    // 현재 프로필 정보 업데이트
    await updateCurrentProfileInfo();
    
    // 운동 관리 화면으로 이동
    showScreen('exercise-screen');
    
    // 계획 목록 업데이트
    await updatePlansList();
}

// 현재 프로필 정보 업데이트
async function updateCurrentProfileInfo() {
    const profileData = await getProfileData(currentProfile);
    const imgSrc = getProfileImageSrc(currentProfile);
    
    document.getElementById('current-profile-img').src = imgSrc;
    document.getElementById('current-profile-name').textContent = `${currentProfile}님`;
    document.getElementById('current-profile-grade').textContent = profileData.grade;
}

// 프로필 이미지 경로 가져오기
function getProfileImageSrc(profileName) {
    const imageMap = {
        '아빠': 'dad.png',
        '엄마': 'mom.png',
        '주환': 'juhwan.png',
        '태환': 'taehwan.png'
    };
    return imageMap[profileName] || 'icon.png';
}

// 기본 프로필 설정
function setDefaultProfile(profileName) {
    // 모든 기본 설정 버튼 초기화
    document.querySelectorAll('.set-default-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.textContent = '⭐ 기본설정';
    });
    
    // 선택된 프로필의 버튼 활성화
    const profileCard = document.querySelector(`[data-profile="${profileName}"]`);
    const btn = profileCard.querySelector('.set-default-btn');
    btn.classList.add('active');
    btn.textContent = '❤️ 기본';
    
    // 로컬 스토리지에 저장
    const data = loadData();
    data.defaultProfile = profileName;
    saveData(data);
    
    showMessage(`${profileName}님이 기본 프로필로 설정되었습니다.`);
}

// 탭 전환
async function switchTab(tabName) {
    // 탭 버튼 활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 탭 내용 표시
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'calendar') {
        await updateCalendar();
    } else {
        // 다른 탭으로 전환할 때 선택된 계획 초기화 (계획에서 직접 호출된 경우 제외)
        if (tabName !== 'calendar') {
            selectedPlan = null;
        }
    }
}

// 새 계획 추가 팝업 표시
function showAddPlanPopup() {
    document.getElementById('add-plan-popup').classList.add('active');
    
    // 현재 날짜로 초기화
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').value = today;
    document.getElementById('end-date').value = today;
}

// 팝업 숨기기
function hideAddPlanPopup() {
    document.getElementById('add-plan-popup').classList.remove('active');
    document.getElementById('plan-form').reset();
}

// 계획 저장
async function savePlan() {
    const formData = new FormData(document.getElementById('plan-form'));
    const plan = {
        id: Date.now(),
        exercise_type: document.getElementById('exercise-type').value,
        exercise_content: document.getElementById('exercise-content').value,
        start_date: document.getElementById('start-date').value,
        end_date: document.getElementById('end-date').value,
        completed_dates: [],
        created_date: new Date().toLocaleString('ko-KR')
    };
    
    // 데이터 저장
    const data = loadData();
    if (!data.profiles[currentProfile]) {
        data.profiles[currentProfile] = { 
            exercisePlans: [], 
            score: 0, 
            completedCount: 0 
        };
    }
    data.profiles[currentProfile].exercisePlans.push(plan);
    await saveData(data);
    
    // UI 업데이트
    updatePlansList();
    hideAddPlanPopup();
    
    // Firebase 연결 상태에 따른 메시지
    if (isFirebaseAvailable) {
        showMessage('🔥 새 운동 계획이 가족에게 공유되었습니다!');
    } else {
        showMessage('📱 새 운동 계획이 추가되었습니다! (로컬 저장)');
    }
}

// 계획 목록 업데이트
async function updatePlansList() {
    const data = await loadData();
    const profileData = data.profiles[currentProfile] || { exercisePlans: [] };
    const plansList = document.getElementById('plans-list');
    
    plansList.innerHTML = '';
    
    if (profileData.exercisePlans.length === 0) {
        plansList.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: white; background: rgba(255,255,255,0.1); border-radius: 10px;">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">아직 운동 계획이 없습니다.</p>
                <p style="font-size: 1rem;">새 계획을 추가해보세요! 💪</p>
            </div>
        `;
        return;
    }
    
    // 오늘 날짜 계산
    const today = new Date().toISOString().split('T')[0];
    
    // 현재 및 미래 계획만 필터링 (지난 계획 제외)
    const activePlans = profileData.exercisePlans.filter(plan => {
        return plan.end_date >= today;
    });
    
    // 필터링된 계획이 없는 경우
    if (activePlans.length === 0) {
        plansList.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: white; background: rgba(255,255,255,0.1); border-radius: 10px;">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">현재 진행 중인 운동 계획이 없습니다.</p>
                <p style="font-size: 1rem;">새 계획을 추가해보세요! 💪</p>
            </div>
        `;
        
        // 계획 개수 표시 업데이트 (필터링된 개수)
        const plansCount = document.getElementById('plans-count');
        if (plansCount) {
            plansCount.textContent = '0개 계획';
        }
        return;
    }
    
    // 계획 개수 표시 업데이트 (필터링된 개수)
    const plansCount = document.getElementById('plans-count');
    if (plansCount) {
        plansCount.textContent = `${activePlans.length}개 계획`;
    }
    
    // 현재 및 미래 계획들만 표시
    activePlans.forEach(plan => {
        const planElement = createPlanElement(plan);
        plansList.appendChild(planElement);
    });
}

// 계획 요소 생성
function createPlanElement(plan) {
    const element = document.createElement('div');
    element.className = 'plan-item';
    
    const completedCount = plan.completed_dates ? plan.completed_dates.length : 0;
    const totalDays = calculateDaysBetween(plan.start_date, plan.end_date) + 1;
    const progressPercent = Math.round((completedCount / totalDays) * 100);
    
    // 오늘 날짜가 계획 기간에 포함되는지 확인
    const today = new Date().toISOString().split('T')[0];
    const isInPeriod = today >= plan.start_date && today <= plan.end_date;
    const isCompletedToday = plan.completed_dates && plan.completed_dates.includes(today);
    
    element.innerHTML = `
        <div class="plan-header">
            <span class="plan-type">${plan.exercise_type}</span>
            <button class="plan-menu-btn" data-plan-id="${plan.id}" style="background:none; border:none; font-size:1.2rem; cursor:pointer;">⋮</button>
        </div>
        <div class="plan-content">${plan.exercise_content}</div>
        <div class="plan-dates">${plan.start_date} ~ ${plan.end_date}</div>
        <div class="plan-progress">
            완료: ${completedCount}/${totalDays}일 (${progressPercent}%)
        </div>
        ${isInPeriod ? `
        <div class="plan-actions" style="margin-top: 10px; text-align: center;">
            <button class="complete-btn" data-plan-id="${plan.id}" 
                    style="background: ${isCompletedToday ? '#4caf50' : '#2196f3'}; 
                           color: white; border: none; padding: 8px 16px; 
                           border-radius: 5px; cursor: pointer; font-size: 0.9rem;">
                ${isCompletedToday ? '✅ 완료됨' : '💪 오늘 완료하기'}
            </button>
        </div>
        ` : ''}
    `;
    
    // 완료 버튼 이벤트 추가
    const completeBtn = element.querySelector('.complete-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', async function(e) {
            e.stopPropagation(); // 부모 클릭 이벤트 방지
            const planId = parseInt(this.dataset.planId);
            await toggleExerciseCompletion(planId);
        });
    }
    
    // 계획 카드 클릭 이벤트 (완료 버튼 제외)
    element.addEventListener('click', async function(e) {
        if (!e.target.classList.contains('complete-btn')) {
            await showPlanCalendar(plan);
        }
    });
    
    return element;
}

// 운동 완료 토글
async function toggleExerciseCompletion(planId) {
    const data = await loadData();
    const profileData = data.profiles[currentProfile];
    
    if (!profileData || !profileData.exercisePlans) {
        showMessage('❌ 프로필 데이터를 찾을 수 없습니다.');
        return;
    }
    
    const plan = profileData.exercisePlans.find(p => p.id === planId);
    if (!plan) {
        showMessage('❌ 운동 계획을 찾을 수 없습니다.');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // completed_dates 배열이 없으면 생성
    if (!plan.completed_dates) {
        plan.completed_dates = [];
    }
    
    // 오늘 날짜가 이미 완료되었는지 확인
    const todayIndex = plan.completed_dates.indexOf(today);
    const exerciseScore = getExerciseScore(plan.exercise_type);
    
    if (todayIndex > -1) {
        // 이미 완료된 경우 - 완료 취소
        plan.completed_dates.splice(todayIndex, 1);
        await saveData(data);
        
        if (isFirebaseAvailable) {
            showMessage(`🔄 ${plan.exercise_type} 완료를 취소했습니다! (-${exerciseScore}점)`);
        } else {
            showMessage(`📱 ${plan.exercise_type} 완료를 취소했습니다! (-${exerciseScore}점)`);
        }
    } else {
        // 완료되지 않은 경우 - 완료 처리
        plan.completed_dates.push(today);
        await saveData(data);
        
        if (isFirebaseAvailable) {
            showMessage(`🎉 ${plan.exercise_type} 완료! +${exerciseScore}점 획득! 가족에게 공유되었습니다!`);
        } else {
            showMessage(`🎉 ${plan.exercise_type} 완료! +${exerciseScore}점 획득!`);
        }
    }
    
    // UI 업데이트
    await updatePlansList();
    await updateRanking();
    await updateCurrentProfileInfo();
}

// 계획별 캘린더 표시
async function showPlanCalendar(plan) {
    // 선택된 계획 저장
    selectedPlan = plan;
    
    // 계획 시작 날짜의 달로 캘린더 이동
    const startDate = new Date(plan.start_date);
    currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    // 캘린더 탭으로 전환
    await switchTab('calendar');
    
    // 계획 정보 표시
    const completedCount = plan.completed_dates ? plan.completed_dates.length : 0;
    const totalDays = calculateDaysBetween(plan.start_date, plan.end_date) + 1;
    const progressPercent = Math.round((completedCount / totalDays) * 100);
    
    showMessage(`📅 ${plan.exercise_type} 계획 (${plan.start_date} ~ ${plan.end_date})<br>
                💪 진행률: ${completedCount}/${totalDays}일 (${progressPercent}%)<br>
                ✨ 캘린더에서 날짜를 클릭하여 완료 체크!`);
}

// 캘린더 업데이트
async function updateCalendar() {
    const calendarTitle = document.getElementById('calendar-title');
    const calendarGrid = document.getElementById('calendar-grid');
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    calendarTitle.textContent = `${year}년 ${month + 1}월`;
    
    // 캘린더 그리드 생성
    calendarGrid.innerHTML = await createCalendarGrid(year, month);
    
    // 캘린더 일자 클릭 이벤트 리스너 추가
    const calendarDays = calendarGrid.querySelectorAll('.calendar-day:not(.empty)');
    calendarDays.forEach(day => {
        day.addEventListener('click', async function() {
            const dateStr = this.dataset.date;
            if (dateStr) {
                await toggleDateCompletion(dateStr);
            }
        });
    });
}

// 캘린더 월 네비게이션
async function navigateMonth(direction) {
    if (direction === 'prev') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (direction === 'next') {
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    await updateCalendar();
}

// 캘린더 그리드 생성
async function createCalendarGrid(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = `
        <style>
            .calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-bottom: 10px; }
            .calendar-weekdays > div { text-align: center; font-weight: bold; padding: 10px; background: #f0f0f0; border-radius: 5px; }
            .calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
            .calendar-day { text-align: center; padding: 15px 5px; border-radius: 5px; cursor: pointer; transition: all 0.3s; }
            .calendar-day:hover { background: #e3f2fd; }
            .calendar-day.empty { visibility: hidden; }
            .calendar-day.has-exercise { background: #ffecb3; border: 2px solid #ffc107; }
            .calendar-day.completed { background: #c8e6c9; border: 2px solid #4caf50; color: #2e7d32; font-weight: bold; }
            .calendar-day.selected-plan { background: #e1f5fe; border: 3px solid #00bcd4; color: #006064; font-weight: bold; box-shadow: 0 2px 8px rgba(0,188,212,0.3); }
            .calendar-day.selected-completed { background: #a5d6a7; border: 3px solid #00e676; color: #1b5e20; font-weight: bold; box-shadow: 0 2px 8px rgba(0,230,118,0.4); }
        </style>
        <div class="calendar-weekdays">
            <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
        </div>
        <div class="calendar-days">
    `;
    
    // 빈 칸 추가
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // 날짜 추가
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isCompleted = await isDateCompleted(dateStr);
        const hasExercise = await hasExerciseOnDate(dateStr);
        
        // 선택된 계획의 기간인지 확인
        const isSelectedPlan = selectedPlan && 
                              dateStr >= selectedPlan.start_date && 
                              dateStr <= selectedPlan.end_date;
        
        // 선택된 계획에서 완료된 날짜인지 확인
        const isSelectedPlanCompleted = selectedPlan && 
                                       selectedPlan.completed_dates && 
                                       selectedPlan.completed_dates.includes(dateStr);
        
        const extraClasses = [];
        if (isCompleted) extraClasses.push('completed');
        if (hasExercise) extraClasses.push('has-exercise');
        if (isSelectedPlan) extraClasses.push('selected-plan');
        if (isSelectedPlanCompleted) extraClasses.push('selected-completed');
        
        html += `
            <div class="calendar-day ${extraClasses.join(' ')}" 
                 data-date="${dateStr}">
                ${day}
                ${isSelectedPlanCompleted ? '<br>🎯✅' : 
                  (isCompleted ? '<br>✅' : 
                   (isSelectedPlan ? '<br>🎯' : 
                    (hasExercise ? '<br>📅' : '')))}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// 특정 날짜에 완료된 운동이 있는지 확인
async function isDateCompleted(dateStr) {
    const data = await loadData();
    const profileData = data.profiles[currentProfile];
    
    if (!profileData || !profileData.exercisePlans) return false;
    
    return profileData.exercisePlans.some(plan => {
        return plan.completed_dates && plan.completed_dates.includes(dateStr);
    });
}

// 특정 날짜에 운동 계획이 있는지 확인
async function hasExerciseOnDate(dateStr) {
    const data = await loadData();
    const profileData = data.profiles[currentProfile];
    
    if (!profileData || !profileData.exercisePlans) return false;
    
    return profileData.exercisePlans.some(plan => {
        return dateStr >= plan.start_date && dateStr <= plan.end_date;
    });
}

// 날짜 완료 토글
async function toggleDateCompletion(dateStr) {
    const data = await loadData();
    if (!data.profiles[currentProfile]) {
        data.profiles[currentProfile] = { exercisePlans: [] };
    }
    
    const profileData = data.profiles[currentProfile];
    if (!profileData.exercisePlans) {
        profileData.exercisePlans = [];
    }
    
    let dateToggled = false;
    
    profileData.exercisePlans.forEach(plan => {
        // 날짜가 계획 범위 내에 있는지 확인
        if (dateStr >= plan.start_date && dateStr <= plan.end_date) {
            if (!plan.completed_dates) plan.completed_dates = [];
            
            const dateIndex = plan.completed_dates.indexOf(dateStr);
            if (dateIndex > -1) {
                // 완료 취소
                plan.completed_dates.splice(dateIndex, 1);
                showMessage(`${dateStr} 운동 완료를 취소했습니다.`);
            } else {
                // 완료 체크
                plan.completed_dates.push(dateStr);
                showMessage(`${dateStr} 운동을 완료했습니다! 🎉`);
            }
            dateToggled = true;
        }
    });
    
    if (!dateToggled) {
        showMessage('해당 날짜에 운동 계획이 없습니다.');
        return;
    }
    
    await saveData(data);
    await updateCalendar();
    await updateCurrentProfileInfo();
    await updateRanking();
}

// 캘린더 네비게이션
function navigateCalendar(direction) {
    if (direction === 'prev') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    updateCalendar();
}

// 랭킹 업데이트
async function updateRanking() {
    const data = await loadData();
    const rankings = [];
    
    // 기본 프로필들 추가
    const profiles = ['아빠', '엄마', '주환', '태환'];
    for (const profile of profiles) {
        const score = calculateProfileScore(profile, data.profiles[profile]);
        const profileData = await getProfileData(profile);
        rankings.push({ 
            name: profile, 
            score: score,
            grade: profileData.grade 
        });
    }
    
    rankings.sort((a, b) => b.score - a.score);
    
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    
    rankings.forEach((item, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        // 순위 표시 (1위, 2위, 3위, 4위)
        const rankNumber = index + 1;
        const imgSrc = getProfileImageSrc(item.name);
        
        // 순위에 따른 배경색
        let bgColor = '#f8f9fa';
        if (index === 0) bgColor = '#fff3cd'; // 1위 - 골드
        else if (index === 1) bgColor = '#e2e3e5'; // 2위 - 실버
        else if (index === 2) bgColor = '#f8d7da'; // 3위 - 브론즈
        
        rankingItem.innerHTML = `
            <div class="rank-content" style="display: flex; align-items: center; padding: 12px; background: ${bgColor}; border-radius: 10px; margin-bottom: 8px;">
                <div class="rank-number" style="font-size: 1.2rem; font-weight: bold; margin-right: 15px; min-width: 30px;">
                    ${rankNumber}위
                </div>
                <div class="rank-profile-img" style="margin-right: 15px;">
                    <img src="${imgSrc}" alt="${item.name}" 
                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #007bff;"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div style="display: none; width: 40px; height: 40px; border-radius: 50%; background: #007bff; color: white; justify-content: center; align-items: center; font-size: 1.2rem;">
                        ${item.name === '아빠' ? '👨' : item.name === '엄마' ? '👩' : item.name === '주환' ? '👦' : '🧒'}
                    </div>
                </div>
                <div class="rank-info" style="flex: 1;">
                    <div class="rank-name" style="font-weight: bold; font-size: 1rem; margin-bottom: 2px;">
                        ${item.name}
                    </div>
                    <div class="rank-details" style="display: flex; align-items: center; gap: 10px; font-size: 0.9rem;">
                        <span class="rank-grade" style="background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                            ${item.grade}
                        </span>
                        <span class="rank-score" style="color: #6c757d; font-weight: 500;">
                            ${item.score}점
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        rankingList.appendChild(rankingItem);
    });
}

// 프로필 카드 정보 업데이트 
async function updateProfileCards() {
    const profiles = ['아빠', '엄마', '주환', '태환'];
    
    for (const profileName of profiles) {
        const profileData = await getProfileData(profileName);
        const profileCard = document.querySelector(`[data-profile="${profileName}"]`);
        
        if (profileCard) {
            const gradeElement = profileCard.querySelector('.grade');
            const scoreElement = profileCard.querySelector('.score');
            
            if (gradeElement) gradeElement.textContent = profileData.grade;
            if (scoreElement) scoreElement.textContent = `${profileData.score}점`;
        }
    }
}

// 프로필 점수 계산
function calculateProfileScore(profileName, profileData) {
    if (!profileData || !profileData.exercisePlans) return 0;
    
    let totalScore = 0;
    profileData.exercisePlans.forEach(plan => {
        const completedDays = plan.completed_dates ? plan.completed_dates.length : 0;
        totalScore += completedDays * getExerciseScore(plan.exercise_type);
    });
    
    return totalScore;
}

// 운동 종류별 점수
function getExerciseScore(exerciseType) {
    const scores = {
        '달리기': 15,
        '러닝머신': 15,
        '수영': 20,
        '자전거': 12,
        '기구운동': 18,
        '요가': 10,
        '걷기': 8,
        '기타': 5
    };
    return scores[exerciseType] || 5;
}

// 프로필 데이터 가져오기
async function getProfileData(profileName) {
    const data = await loadData();
    const profileData = data.profiles[profileName];
    const score = calculateProfileScore(profileName, profileData);
    
    let grade = '⛓️ 노예';
    if (score >= 400) grade = '✨ 신';
    else if (score >= 300) grade = '👑 왕';
    else if (score >= 200) grade = '🛡️ 백작';
    else if (score >= 120) grade = '🏇 기사';
    else if (score >= 50) grade = '🌾 농민';
    
    return { score, grade };
}

// 날짜 사이의 일수 계산
function calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 특정 날짜에 운동 완료 여부 확인
function isDateCompleted(dateStr) {
    const data = loadData();
    const profileData = data.profiles[currentProfile];
    if (!profileData) return false;
    
    return profileData.plans.some(plan => 
        plan.completedDates && plan.completedDates.includes(dateStr)
    );
}

// 특정 날짜에 운동 계획 여부 확인
function hasExerciseOnDate(dateStr) {
    const data = loadData();
    const profileData = data.profiles[currentProfile];
    if (!profileData) return false;
    
    return profileData.plans.some(plan => {
        const startDate = new Date(plan.startDate);
        const endDate = new Date(plan.endDate);
        const checkDate = new Date(dateStr);
        return checkDate >= startDate && checkDate <= endDate;
    });
}

// Firebase에서 데이터 로드
async function loadDataFromFirebase() {
    if (!isFirebaseAvailable) return null;
    
    try {
        const doc = await db.collection('families').doc(FAMILY_CODE).get();
        if (doc.exists) {
            console.log("🔥 Firebase에서 데이터 로드 성공");
            return doc.data();
        }
        return null;
    } catch (error) {
        console.warn("⚠️ Firebase 데이터 로드 실패:", error);
        return null;
    }
}

// Firebase에 데이터 저장
async function saveDataToFirebase(data) {
    if (!isFirebaseAvailable) return false;
    
    try {
        await db.collection('families').doc(FAMILY_CODE).set(data, { merge: true });
        console.log("🔥 Firebase에 데이터 저장 성공");
        return true;
    } catch (error) {
        console.warn("⚠️ Firebase 데이터 저장 실패:", error);
        return false;
    }
}

// 데이터 로드 (Firebase 우선, 로컬 백업)
async function loadData() {
    // Firebase에서 먼저 시도
    if (isFirebaseAvailable) {
        const firebaseData = await loadDataFromFirebase();
        if (firebaseData) {
            return firebaseData;
        }
    }
    
    // Firebase 실패시 로컬에서 로드
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    
    // 아빠의 미리 등록된 운동 계획
    const dadExercisePlans = [
        {
            "id": 2,
            "exercise_type": "달리기",
            "exercise_content": "4km 가볍게 (6:30/km)",
            "start_date": "2025-07-18",
            "end_date": "2025-07-18",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 3,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:20/km) + 하체 스트레칭",
            "start_date": "2025-07-19",
            "end_date": "2025-07-19",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 4,
            "exercise_type": "달리기",
            "exercise_content": "6km 조깅 (6:10/km)",
            "start_date": "2025-07-22",
            "end_date": "2025-07-22",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 5,
            "exercise_type": "달리기",
            "exercise_content": "2km 조깅 (6:10/km) + 4×400m 인터벌(5:00/km) + 2km 조깅 → 총 6.6km, 평균 5:50/km",
            "start_date": "2025-07-24",
            "end_date": "2025-07-24",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 6,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:20/km)",
            "start_date": "2025-07-26",
            "end_date": "2025-07-26",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 7,
            "exercise_type": "달리기",
            "exercise_content": "7km 지구력주 (6:00/km)",
            "start_date": "2025-07-29",
            "end_date": "2025-07-29",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 8,
            "exercise_type": "달리기",
            "exercise_content": "5km 템포런 (5:30/km)",
            "start_date": "2025-07-31",
            "end_date": "2025-07-31",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 9,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:30/km) + 보강운동",
            "start_date": "2025-08-02",
            "end_date": "2025-08-02",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 10,
            "exercise_type": "달리기",
            "exercise_content": "8km 지구력주 (6:00/km)",
            "start_date": "2025-08-05",
            "end_date": "2025-08-05",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 11,
            "exercise_type": "달리기",
            "exercise_content": "2km 조깅 + 5×400m 인터벌(4:50/km) + 2km 조깅 → 총 7km, 평균 5:40/km",
            "start_date": "2025-08-07",
            "end_date": "2025-08-07",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 12,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:20/km)",
            "start_date": "2025-08-09",
            "end_date": "2025-08-09",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 13,
            "exercise_type": "달리기",
            "exercise_content": "9km 지구력주 (6:00/km)",
            "start_date": "2025-08-12",
            "end_date": "2025-08-12",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 14,
            "exercise_type": "달리기",
            "exercise_content": "6km 템포런 (5:20/km)",
            "start_date": "2025-08-14",
            "end_date": "2025-08-14",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 15,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:30/km) + 코어운동",
            "start_date": "2025-08-16",
            "end_date": "2025-08-16",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 16,
            "exercise_type": "달리기",
            "exercise_content": "10km 롱런 (6:00/km)",
            "start_date": "2025-08-19",
            "end_date": "2025-08-19",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 17,
            "exercise_type": "달리기",
            "exercise_content": "2km 조깅 + 5×500m 인터벌(4:40/km) + 2km 조깅 → 총 7.5km, 평균 5:30/km",
            "start_date": "2025-08-21",
            "end_date": "2025-08-21",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 18,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:20/km)",
            "start_date": "2025-08-23",
            "end_date": "2025-08-23",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 19,
            "exercise_type": "달리기",
            "exercise_content": "10km 롱런 (5:50/km)",
            "start_date": "2025-08-26",
            "end_date": "2025-08-26",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 20,
            "exercise_type": "달리기",
            "exercise_content": "6km 템포런 (5:10/km)",
            "start_date": "2025-08-28",
            "end_date": "2025-08-28",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 21,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:30/km)",
            "start_date": "2025-08-30",
            "end_date": "2025-08-30",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 22,
            "exercise_type": "달리기",
            "exercise_content": "10km 시뮬레이션 (5:20~5:30/km)",
            "start_date": "2025-09-02",
            "end_date": "2025-09-02",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 23,
            "exercise_type": "달리기",
            "exercise_content": "2km 조깅 + 6×500m 인터벌(4:40/km) + 2km 조깅 → 총 8km, 평균 5:20/km",
            "start_date": "2025-09-04",
            "end_date": "2025-09-04",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 24,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:30/km)",
            "start_date": "2025-09-06",
            "end_date": "2025-09-06",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 25,
            "exercise_type": "달리기",
            "exercise_content": "10km 시뮬레이션 (5:10~5:20/km)",
            "start_date": "2025-09-09",
            "end_date": "2025-09-09",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 26,
            "exercise_type": "달리기",
            "exercise_content": "6km 템포런 (5:00/km)",
            "start_date": "2025-09-11",
            "end_date": "2025-09-11",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 27,
            "exercise_type": "달리기",
            "exercise_content": "4km 가볍게 (6:30/km) + 컨디션 조절",
            "start_date": "2025-09-13",
            "end_date": "2025-09-13",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 28,
            "exercise_type": "달리기",
            "exercise_content": "10km 대회! 목표: 50분 (5:00/km)",
            "start_date": "2025-09-20",
            "end_date": "2025-09-20",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        }
    ];
    
    return {
        defaultProfile: null,
        profiles: {
            '아빠': {
                exercisePlans: dadExercisePlans,
                score: 0,
                completedCount: 0
            },
            '엄마': {
                exercisePlans: [],
                score: 0,
                completedCount: 0
            },
            '주환': {
                exercisePlans: [],
                score: 0,
                completedCount: 0
            },
            '태환': {
                exercisePlans: [],
                score: 0,
                completedCount: 0
            }
        }
    };
}

// 데이터 저장 (Firebase + 로컬 백업)
async function saveData(data) {
    // 로컬에 백업 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    // Firebase에도 저장 시도
    if (isFirebaseAvailable) {
        await saveDataToFirebase(data);
    }
}

// 메시지 표시
function showMessage(message) {
    // 간단한 토스트 메시지 구현
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4facfe;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: bold;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    
    // 애니메이션 CSS 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 앱 정보 표시
function showAppInfo() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 15px; padding: 20px; max-width: 500px; width: 95%; max-height: 90vh; overflow-y: auto; text-align: center;">
            <h2 style="color: #4a5568; margin-bottom: 20px;">🔥 우리가족 운동관리 웹앱 v2.0</h2>
            <p style="margin-bottom: 15px; line-height: 1.6;">🏃‍♂️ 가족 모두의 운동을 체계적으로 관리하세요!</p>
            <p style="margin-bottom: 15px; line-height: 1.6;">📊 운동 기록을 통해 점수를 획득하고 랭킹을 확인하세요!</p>
            <p style="margin-bottom: 20px; line-height: 1.6;">🔥 Firebase 실시간 공유로 가족과 함께하세요!</p>
            
            <h3 style="color: #4a5568; margin: 20px 0 10px;">💡 사용법:</h3>
            <ol style="text-align: left; margin-bottom: 20px; line-height: 1.6;">
                <li>프로필을 선택하세요</li>
                <li>운동 계획을 추가하세요</li>
                <li><strong>💪 오늘 완료하기</strong> 버튼으로 운동 완료!</li>
                <li>점수를 획득하고 가족 랭킹을 확인하세요</li>
            </ol>
            
            <h3 style="color: #2196f3; margin: 20px 0 10px;">🏆 점수 시스템:</h3>
            <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 8px;"><strong>🏃‍♂️ 달리기:</strong> 15점/일</div>
                <div style="margin-bottom: 8px;"><strong>🏊‍♂️ 수영:</strong> 20점/일</div>
                <div style="margin-bottom: 8px;"><strong>🏋️‍♂️ 기구운동:</strong> 18점/일</div>
                <div style="margin-bottom: 8px;"><strong>🚴‍♂️ 자전거:</strong> 12점/일</div>
                <div style="margin-bottom: 8px;"><strong>🧘‍♀️ 요가:</strong> 10점/일</div>
                <div style="margin-bottom: 8px;"><strong>🚶‍♂️ 걷기:</strong> 8점/일</div>
                <div><strong>🏃‍♂️ 러닝머신:</strong> 15점/일</div>
            </div>
            
            <h3 style="color: #ff9800; margin: 20px 0 10px;">🏰 중세 계급 시스템:</h3>
            <div style="text-align: left; background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 8px;"><strong>✨ 신:</strong> 400점 이상</div>
                <div style="margin-bottom: 8px;"><strong>👑 왕:</strong> 300-399점</div>
                <div style="margin-bottom: 8px;"><strong>🛡️ 백작:</strong> 200-299점</div>
                <div style="margin-bottom: 8px;"><strong>🏇 기사:</strong> 120-199점</div>
                <div style="margin-bottom: 8px;"><strong>🌾 농민:</strong> 50-119점</div>
                <div><strong>⛓️ 노예:</strong> 0-49점</div>
            </div>
            
            <h3 style="color: #4caf50; margin: 20px 0 10px;">🔥 실시간 공유:</h3>
            <div style="text-align: left; background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="margin-bottom: 8px;">✅ <strong>자동 가족 그룹:</strong> OUR_FAMILY_2024</div>
                <div style="margin-bottom: 8px;">✅ <strong>실시간 동기화:</strong> 운동 완료시 즉시 공유</div>
                <div style="margin-bottom: 8px;">✅ <strong>클라우드 백업:</strong> 데이터 분실 걱정 없음</div>
                <div>✅ <strong>오프라인 지원:</strong> 인터넷 없어도 기록 가능</div>
            </div>
            
            <p style="color: #666; font-style: italic; margin-bottom: 20px;">Made with ❤️ for Family Fitness<br/>
            <small>v2.0 - Firebase 실시간 공유 + 완벽한 점수 시스템</small></p>
            <button onclick="this.closest('div').parentElement.remove()" 
                    style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                           color: white; border: none; border-radius: 8px; 
                           padding: 12px 24px; cursor: pointer; font-size: 1rem;">
                확인
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}
