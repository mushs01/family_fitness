// 전역 변수
let currentProfile = null;
let exercisePlan = [];
let currentDate = new Date();

// 로컬 스토리지 키
const STORAGE_KEY = 'family_fitness_data';

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    // 로딩 화면 표시
    showScreen('loading-screen');
    
    // 3초 후 프로필 선택 화면으로 이동
    setTimeout(() => {
        showScreen('profile-screen');
        updateRanking();
    }, 3000);
    
    setupEventListeners();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 프로필 카드 클릭
    document.querySelectorAll('.profile-card').forEach(card => {
        card.addEventListener('click', function() {
            const profile = this.dataset.profile;
            selectProfile(profile);
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
    document.querySelector('.back-btn').addEventListener('click', function() {
        showScreen('profile-screen');
    });
    
    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
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
function selectProfile(profileName) {
    currentProfile = profileName;
    
    // 현재 프로필 정보 업데이트
    updateCurrentProfileInfo();
    
    // 운동 관리 화면으로 이동
    showScreen('exercise-screen');
    
    // 계획 목록 업데이트
    updatePlansList();
}

// 현재 프로필 정보 업데이트
function updateCurrentProfileInfo() {
    const profileData = getProfileData(currentProfile);
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
function switchTab(tabName) {
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
        updateCalendar();
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
function savePlan() {
    const formData = new FormData(document.getElementById('plan-form'));
    const plan = {
        id: Date.now(),
        profile: currentProfile,
        exerciseType: document.getElementById('exercise-type').value,
        exerciseContent: document.getElementById('exercise-content').value,
        startDate: document.getElementById('start-date').value,
        endDate: document.getElementById('end-date').value,
        completedDates: [],
        createdDate: new Date().toISOString()
    };
    
    // 데이터 저장
    const data = loadData();
    if (!data.profiles[currentProfile]) {
        data.profiles[currentProfile] = { plans: [], score: 0 };
    }
    data.profiles[currentProfile].plans.push(plan);
    saveData(data);
    
    // UI 업데이트
    updatePlansList();
    hideAddPlanPopup();
    showMessage('새 운동 계획이 추가되었습니다!');
}

// 계획 목록 업데이트
function updatePlansList() {
    const data = loadData();
    const profileData = data.profiles[currentProfile] || { plans: [] };
    const plansList = document.getElementById('plans-list');
    
    plansList.innerHTML = '';
    
    if (profileData.plans.length === 0) {
        plansList.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: white; background: rgba(255,255,255,0.1); border-radius: 10px;">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">아직 운동 계획이 없습니다.</p>
                <p style="font-size: 1rem;">새 계획을 추가해보세요! 💪</p>
            </div>
        `;
        return;
    }
    
    profileData.plans.forEach(plan => {
        const planElement = createPlanElement(plan);
        plansList.appendChild(planElement);
    });
}

// 계획 요소 생성
function createPlanElement(plan) {
    const element = document.createElement('div');
    element.className = 'plan-item';
    
    const completedCount = plan.completedDates ? plan.completedDates.length : 0;
    const totalDays = calculateDaysBetween(plan.startDate, plan.endDate) + 1;
    const progressPercent = Math.round((completedCount / totalDays) * 100);
    
    element.innerHTML = `
        <div class="plan-header">
            <span class="plan-type">${plan.exerciseType}</span>
            <button class="plan-menu-btn" data-plan-id="${plan.id}" style="background:none; border:none; font-size:1.2rem; cursor:pointer;">⋮</button>
        </div>
        <div class="plan-content">${plan.exerciseContent}</div>
        <div class="plan-dates">${plan.startDate} ~ ${plan.endDate}</div>
        <div class="plan-progress">
            완료: ${completedCount}/${totalDays}일 (${progressPercent}%)
        </div>
    `;
    
    // 클릭 이벤트 추가
    element.addEventListener('click', function() {
        showPlanCalendar(plan);
    });
    
    return element;
}

// 계획별 캘린더 표시
function showPlanCalendar(plan) {
    // 여기서 캘린더 탭으로 전환하고 해당 계획의 달력을 표시
    switchTab('calendar');
    showMessage(`${plan.exerciseType} 계획의 캘린더를 표시합니다.`);
}

// 캘린더 업데이트
function updateCalendar() {
    const calendarTitle = document.getElementById('calendar-title');
    const calendarGrid = document.getElementById('calendar-grid');
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    calendarTitle.textContent = `${year}년 ${month + 1}월`;
    
    // 캘린더 그리드 생성
    calendarGrid.innerHTML = createCalendarGrid(year, month);
}

// 캘린더 그리드 생성
function createCalendarGrid(year, month) {
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
        const isCompleted = isDateCompleted(dateStr);
        const hasExercise = hasExerciseOnDate(dateStr);
        
        html += `
            <div class="calendar-day ${isCompleted ? 'completed' : ''} ${hasExercise ? 'has-exercise' : ''}" 
                 data-date="${dateStr}"
                 onclick="toggleDateCompletion('${dateStr}')">
                ${day}
                ${isCompleted ? '<br>✅' : (hasExercise ? '<br>📅' : '')}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// 날짜 완료 토글
function toggleDateCompletion(dateStr) {
    const data = loadData();
    if (!data.profiles[currentProfile]) {
        data.profiles[currentProfile] = { plans: [] };
    }
    
    const profileData = data.profiles[currentProfile];
    let dateToggled = false;
    
    profileData.plans.forEach(plan => {
        const startDate = new Date(plan.startDate);
        const endDate = new Date(plan.endDate);
        const checkDate = new Date(dateStr);
        
        // 날짜가 계획 범위 내에 있는지 확인
        if (checkDate >= startDate && checkDate <= endDate) {
            if (!plan.completedDates) plan.completedDates = [];
            
            const dateIndex = plan.completedDates.indexOf(dateStr);
            if (dateIndex > -1) {
                // 완료 취소
                plan.completedDates.splice(dateIndex, 1);
                showMessage(`${dateStr} 운동 완료를 취소했습니다.`);
            } else {
                // 완료 체크
                plan.completedDates.push(dateStr);
                showMessage(`${dateStr} 운동을 완료했습니다! 🎉`);
            }
            dateToggled = true;
        }
    });
    
    if (!dateToggled) {
        showMessage('해당 날짜에 운동 계획이 없습니다.');
        return;
    }
    
    saveData(data);
    updateCalendar();
    updateRanking();
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
function updateRanking() {
    const data = loadData();
    const rankings = [];
    
    // 기본 프로필들 추가
    const profiles = ['아빠', '엄마', '주환', '태환'];
    profiles.forEach(profile => {
        const score = calculateProfileScore(profile, data.profiles[profile]);
        rankings.push({ name: profile, score });
    });
    
    rankings.sort((a, b) => b.score - a.score);
    
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    
    rankings.forEach((item, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        const medals = ['🥇', '🥈', '🥉', '🏅'];
        const medal = medals[index] || '🏅';
        
        rankingItem.innerHTML = `
            <div>${medal}</div>
            <div>${item.name}</div>
            <div>${item.score}점</div>
        `;
        
        rankingList.appendChild(rankingItem);
    });
}

// 프로필 점수 계산
function calculateProfileScore(profileName, profileData) {
    if (!profileData || !profileData.plans) return 0;
    
    let totalScore = 0;
    profileData.plans.forEach(plan => {
        const completedDays = plan.completedDates ? plan.completedDates.length : 0;
        totalScore += completedDays * getExerciseScore(plan.exerciseType);
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
function getProfileData(profileName) {
    const data = loadData();
    const profileData = data.profiles[profileName];
    const score = calculateProfileScore(profileName, profileData);
    
    let grade = '🥉 브론즈';
    if (score >= 300) grade = '🏆 레전드';
    else if (score >= 200) grade = '💎 다이아';
    else if (score >= 100) grade = '🥇 골드';
    else if (score >= 50) grade = '🥈 실버';
    
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

// 데이터 로드
function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    
    return {
        defaultProfile: null,
        profiles: {}
    };
}

// 데이터 저장
function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
        <div style="background: white; border-radius: 15px; padding: 30px; max-width: 400px; width: 90%; text-align: center;">
            <h2 style="color: #4a5568; margin-bottom: 20px;">우리가족 운동관리 웹앱 v1.0</h2>
            <p style="margin-bottom: 15px; line-height: 1.6;">🏃‍♂️ 가족 모두의 운동을 체계적으로 관리하세요!</p>
            <p style="margin-bottom: 15px; line-height: 1.6;">📊 운동 기록을 통해 점수를 획득하고 랭킹을 확인하세요!</p>
            <p style="margin-bottom: 20px; line-height: 1.6;">📅 개인별 운동 계획을 세우고 캘린더로 관리하세요!</p>
            
            <h3 style="color: #4a5568; margin: 20px 0 10px;">💡 사용법:</h3>
            <ol style="text-align: left; margin-bottom: 20px; line-height: 1.6;">
                <li>프로필을 선택하세요</li>
                <li>운동 계획을 추가하세요</li>
                <li>매일 운동 완료를 체크하세요</li>
                <li>가족 랭킹을 확인하세요</li>
            </ol>
            
            <p style="color: #666; font-style: italic; margin-bottom: 20px;">Made with ❤️ for Family Fitness</p>
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