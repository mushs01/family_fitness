// 전역 변수
let currentProfile = null;
let exercisePlan = [];
let currentDate = new Date();
let selectedPlan = null;
let isUpdatingFromFirebase = false; // Firebase 업데이트 중인지 확인

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

// PWA 캐시 강제 업데이트 (모바일 앱에서 중요) - 개선된 버전
async function forceCacheUpdate() {
    console.log('🧹 강력한 캐시 정리 시작...');
    
    // 모든 캐시 강제 삭제
    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            console.log('발견된 캐시들:', cacheNames);
            
            await Promise.all(cacheNames.map(async (cacheName) => {
                await caches.delete(cacheName);
                console.log('❌ 캐시 삭제:', cacheName);
            }));
            
            console.log('✅ 모든 캐시 삭제 완료');
        } catch (error) {
            console.warn('⚠️ 캐시 삭제 실패:', error);
        }
    }
    
    // LocalStorage 캐시 데이터 정리 (Firebase 동기화 개선)
    try {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(key => 
            key.includes('cache') || 
            key.includes('timestamp') || 
            key.includes('version')
        );
        
        cacheKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log('🗑️ LocalStorage 캐시 삭제:', key);
        });
        
        // Firebase 동기화를 위한 강제 새로고침 플래그 설정
        localStorage.setItem('force_firebase_sync', 'true');
        console.log('🔄 Firebase 강제 동기화 플래그 설정');
        
    } catch (error) {
        console.warn('⚠️ LocalStorage 정리 실패:', error);
    }
    
    // Service Worker 완전 재시작
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                console.log('🔄 Service Worker 재등록 중...');
                await registration.unregister();
                console.log('❌ Service Worker 등록 해제됨');
            }
            
            // 새로 등록 (지연 시간 단축)
            setTimeout(async () => {
                try {
                    const newReg = await navigator.serviceWorker.register('./sw.js');
                    console.log('✅ Service Worker 새로 등록됨');
                    
                    // Service Worker 준비 완료 후 Firebase 동기화 강제 실행
                    if (newReg.active) {
                        console.log('🔥 Service Worker 활성화 후 Firebase 동기화 재시작');
                        setTimeout(() => {
                            if (isFirebaseAvailable) {
                                setupFirebaseSync();
                            }
                        }, 2000);
                    }
                } catch (error) {
                    console.warn('⚠️ Service Worker 재등록 실패:', error);
                }
            }, 500); // 1초에서 0.5초로 단축
            
        } catch (error) {
            console.warn('⚠️ Service Worker 처리 실패:', error);
        }
    }
    
    // 브라우저 캐시 무효화
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Cache-Control';
    meta.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(meta);
    
    // 추가 캐시 무효화 헤더
    const pragmaMeta = document.createElement('meta');
    pragmaMeta.httpEquiv = 'Pragma';
    pragmaMeta.content = 'no-cache';
    document.head.appendChild(pragmaMeta);
    
    const expiresMeta = document.createElement('meta');
    expiresMeta.httpEquiv = 'Expires';
    expiresMeta.content = '0';
    document.head.appendChild(expiresMeta);
    
    console.log('⏰ 캐시 버스팅 타임스탬프:', Date.now());
}

// 초기화
document.addEventListener('DOMContentLoaded', async function() {
    // 모바일/PWA에서 캐시 업데이트 먼저 실행
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isMobile || isPWA) {
        console.log('📱 모바일/PWA 환경에서 캐시 업데이트 실행');
        await forceCacheUpdate();
    }
    
    await initializeApp();
});

// 캐시 강제 삭제 (개발/디버깅용)
async function clearAllCaches() {
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('모든 캐시 삭제 완료');
        
        // Service Worker 등록 해제 후 재등록
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('Service Worker 등록 해제 완료');
            
            // 페이지 새로고침
            window.location.reload(true);
        }
    }
}

// 간단한 대체 이미지 (작고 가벼움)
const SIMPLE_FALLBACK = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIj48c3RvcCBzdG9wLWNvbG9yPSIjNjY3ZWVhIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNzY0YmEyIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9InVybCgjZykiLz48dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7Rgb7stZw8L3RleHQ+PC9zdmc+";

// 로딩 화면 배경 이미지 설정 (단순하고 가벼운 버전)
function setLoadingBackground() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    
    console.log('🖼️ 로딩 이미지 설정 시작 (단순 버전)');
    
    // 간단한 경로들만 시도
    const paths = [
        'https://mushs01.github.io/family_fitness/family_image.png',
        './family_image.png',
        'family_image.png'
    ];
    
    let imageFound = false;
    
    function tryPath(index) {
        if (index >= paths.length || imageFound) {
            if (!imageFound) {
                console.log('🎨 간단한 대체 이미지 사용');
                loadingScreen.style.backgroundImage = `url('${SIMPLE_FALLBACK}')`;
                loadingScreen.style.backgroundSize = 'cover';
                loadingScreen.style.backgroundPosition = 'center';
            }
            return;
        }
        
        const img = new Image();
        img.onload = function() {
            if (!imageFound) {
                imageFound = true;
                console.log('✅ 이미지 로드 성공:', paths[index]);
                loadingScreen.style.backgroundImage = `url('${this.src}')`;
                loadingScreen.style.backgroundSize = 'cover';
                loadingScreen.style.backgroundPosition = 'center';
                loadingScreen.style.backgroundRepeat = 'no-repeat';
            }
        };
        img.onerror = function() {
            console.log('❌ 실패:', paths[index]);
            tryPath(index + 1);
        };
        img.src = paths[index];
        
        // 1초 후 다음 경로 시도
        setTimeout(() => {
            if (!imageFound) {
                tryPath(index + 1);
            }
        }, 1000);
    }
    
    tryPath(0);
}

// 앱 초기화
async function initializeApp() {
    try {
        console.log('🚀 앱 초기화 시작');
        
        // 모바일 환경 감지 (먼저 정의)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isPWA = window.matchMedia('(display-mode: standalone)').matches;
        console.log('📱 모바일 감지:', isMobile, 'PWA 모드:', isPWA);
        
        // 로딩 화면 표시
        showScreen('loading-screen');
        console.log('✅ 로딩 화면 표시됨');
        
        // 배경 이미지 설정
        setLoadingBackground();
        console.log('✅ 배경 이미지 설정 완료');
        
        // 로딩 상태 업데이트
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Firebase 연결 중...';
            console.log('✅ 로딩 텍스트 업데이트됨');
        }
        
        // 데이터 로드
        console.log('📊 데이터 로드 시작...');
        await loadData();
        console.log('✅ 데이터 로드 완료');
        
        // 기존 계획들을 월별 데이터로 마이그레이션
        if (loadingText) {
            loadingText.textContent = '기존 데이터 마이그레이션 중...';
        }
        console.log('🔄 데이터 마이그레이션 시작...');
        await migrateExistingPlansToMonthly();
        console.log('✅ 데이터 마이그레이션 완료');
        
        // 월별 초기화 확인 (매월 1일)
        if (loadingText) {
            loadingText.textContent = '월별 랭킹 확인 중...';
        }
        console.log('🗓️ 월별 초기화 확인...');
        const wasReset = await checkAndPerformMonthlyReset();
        if (wasReset) {
            console.log('✅ 월별 초기화 완료');
        } else {
            console.log('✅ 월별 초기화 불필요');
        }
        
        // Firebase 실시간 동기화 설정
        console.log('🔥 Firebase 동기화 설정...');
        setupFirebaseSync();
        console.log('✅ Firebase 동기화 설정 완료');
        
        // 로딩 완료 - 텍스트 숨기기
        if (loadingText) {
            loadingText.style.display = 'none';
        }
        console.log('✅ 로딩 텍스트 숨김');
        
        // 이벤트 리스너 설정
        console.log('⚡ 이벤트 리스너 설정...');
        setupEventListeners();
        console.log('✅ 이벤트 리스너 설정 완료');
        
        // 모바일에서 더 안전한 화면 전환을 위한 다중 방법 사용
        let transitionCompleted = false;
        
        // 방법 1: 일반 setTimeout (3초)
        console.log('⏰ 3초 후 프로필 화면으로 이동 예약됨');
        const timeoutId = setTimeout(async () => {
            if (!transitionCompleted) {
                transitionCompleted = true;
                await performScreenTransition('timeout');
            }
        }, 3000);
        
        // 방법 2: 모바일에서 더 빠른 대안 (2초)
        if (isMobile || isPWA) {
            console.log('📱 모바일/PWA용 빠른 전환 타이머 설정 (2초)');
            setTimeout(async () => {
                if (!transitionCompleted) {
                    transitionCompleted = true;
                    clearTimeout(timeoutId);
                    await performScreenTransition('mobile-fast');
                }
            }, 2000);
        }
        
        // 방법 3: Page Visibility API로 포그라운드 복귀시 즉시 전환
        let visibilityTimer;
        const handleVisibilityChange = async () => {
            if (!document.hidden && !transitionCompleted) {
                console.log('👁️ 페이지가 포그라운드로 복귀 - 즉시 전환');
                transitionCompleted = true;
                clearTimeout(timeoutId);
                clearTimeout(visibilityTimer);
                await performScreenTransition('visibility');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // 방법 4: 강제 전환 (10초 후 - 백업)
        setTimeout(async () => {
            if (!transitionCompleted) {
                console.log('🚨 강제 전환 실행 (10초 경과)');
                transitionCompleted = true;
                await performScreenTransition('force');
            }
        }, 10000);
        
        // 화면 전환 실행 함수
        async function performScreenTransition(method) {
            try {
                console.log(`🔄 프로필 화면으로 전환 시작 (${method} 방법)`);
                showScreen('profile-screen');
                console.log('✅ 프로필 화면 표시됨');
                
                // 모바일에서는 UI 업데이트를 나중에 처리
                if (isMobile || isPWA) {
                    setTimeout(async () => {
                        try {
                            console.log('📊 랭킹 업데이트 시작... (모바일 지연)');
                            await updateRanking();
                            console.log('✅ 랭킹 업데이트 완료');
                            
                            console.log('👥 프로필 카드 업데이트 시작... (모바일 지연)');
                            await updateProfileCards();
                            console.log('✅ 프로필 카드 업데이트 완료');
                            
                            // 날씨 기능 초기화 (모바일)
                            initWeatherFeature();
                            
                            console.log('🎉 앱 초기화 완전히 완료! (모바일)');
                        } catch (error) {
                            console.error('❌ 모바일 UI 업데이트 중 오류:', error);
                        }
                    }, 500);
                } else {
                    console.log('📊 랭킹 업데이트 시작...');
                    await updateRanking();
                    console.log('✅ 랭킹 업데이트 완료');
                    
                    console.log('👥 프로필 카드 업데이트 시작...');
                    await updateProfileCards();
                    console.log('✅ 프로필 카드 업데이트 완료');
                    
                    // 날씨 기능 초기화 (데스크톱)
                    initWeatherFeature();
                    
                    console.log('🎉 앱 초기화 완전히 완료!');
                }
                
                // 이벤트 리스너 정리
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                
            } catch (error) {
                console.error('❌ 프로필 화면 전환 중 오류:', error);
                // 오류 발생 시에도 프로필 화면으로 이동
                showScreen('profile-screen');
            }
        }
        
        console.log('✅ 앱 초기화 메인 단계 완료');
        
    } catch (error) {
        console.error('❌ 앱 초기화 중 치명적 오류:', error);
        
        // 오류 발생 시 사용자에게 알림
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = '오류가 발생했습니다. 잠시 후 다시 시도합니다...';
            loadingText.style.color = '#ff6b6b';
        }
        
        // 5초 후 강제로 프로필 화면으로 이동
        setTimeout(() => {
            console.log('🔄 오류 복구: 프로필 화면으로 강제 이동');
            showScreen('profile-screen');
        }, 5000);
    }
}

// Firebase 실시간 동기화 설정 - 개선된 버전
function setupFirebaseSync() {
    if (!isFirebaseAvailable) {
        console.log("📱 로컬 모드로 동작");
        return;
    }
    
    console.log('🔥 Firebase 실시간 리스너 설정 중...');
    
    // Firestore 실시간 리스너 설정
    db.collection('families').doc(FAMILY_CODE)
        .onSnapshot(async (doc) => {
            try {
                // 문서가 존재하고, 대기 중인 쓰기가 없고, 현재 업데이트 중이 아닐 때만 처리
                if (doc.exists && doc.metadata.hasPendingWrites === false && !isUpdatingFromFirebase) {
                    console.log("🔄 Firebase에서 실시간 데이터 수신");
                    const firebaseData = doc.data();
                    
                    // 현재 로컬 데이터와 비교
                    const localDataStr = localStorage.getItem(STORAGE_KEY);
                    const localData = localDataStr ? JSON.parse(localDataStr) : null;
                    
                    // 타임스탬프 비교로 불필요한 업데이트 방지
                    const firebaseTimestamp = firebaseData.lastUpdated?.toDate?.() || new Date(0);
                    const localTimestamp = localData?.lastUpdated ? new Date(localData.lastUpdated) : new Date(0);
                    
                    console.log('Firebase 타임스탬프:', firebaseTimestamp);
                    console.log('로컬 타임스탬프:', localTimestamp);
                    
                    // Firebase 데이터가 더 최신이거나 같을 때만 병합
                    if (firebaseTimestamp >= localTimestamp) {
                        console.log('🔄 데이터 병합 시작 (Firebase 데이터가 더 최신)');
                        
                        // 로컬 데이터와 Firebase 데이터 병합
                        const mergedData = await mergeDataSafely(firebaseData);
                        
                        // 로컬 저장소 업데이트
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedData));
                        
                        // UI 업데이트 (Firebase 업데이트 중임을 표시)
                        isUpdatingFromFirebase = true;
                        
                        // 현재 프로필이 있으면 UI 업데이트
                        if (currentProfile) {
                            await updatePlansList();
                            await updateRanking();
                            await updateCurrentProfileInfo();
                        } else {
                            // 프로필 선택 화면에 있을 때도 업데이트
                            await updateRanking();
                            await updateProfileCards();
                        }
                        
                        // 플래그 해제
                        setTimeout(() => {
                            isUpdatingFromFirebase = false;
                        }, 1500);
                        
                        showMessage("🔄 가족 데이터 동기화 완료", true);
                    } else {
                        console.log('⏭️ 로컬 데이터가 더 최신이므로 병합 생략');
                    }
                } else if (!doc.exists) {
                    console.log('📄 Firebase 문서가 존재하지 않음');
                } else if (doc.metadata.hasPendingWrites) {
                    console.log('⏳ 대기 중인 쓰기 작업이 있음 - 무시');
                } else if (isUpdatingFromFirebase) {
                    console.log('🔄 현재 업데이트 중 - 무시');
                }
            } catch (error) {
                console.error('❌ 실시간 동기화 처리 중 오류:', error);
                isUpdatingFromFirebase = false;
            }
        }, (error) => {
            console.warn("⚠️ Firebase 실시간 동기화 오류:", error);
            isUpdatingFromFirebase = false;
            
            // 연결 재시도 로직
            setTimeout(() => {
                console.log('🔄 Firebase 연결 재시도...');
                setupFirebaseSync();
            }, 10000);
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
    

    
    // 뒤로 가기 버튼
    document.querySelector('.back-btn').addEventListener('click', async function() {
        showScreen('profile-screen');
        await updateRanking();
        await updateProfileCards();
    });
    
    // 월별 랭킹 상세 버튼
    document.getElementById('monthly-detail-btn').addEventListener('click', function() {
        showMonthlyRankingScreen();
    });
    
    // 월별 랭킹 뒤로 가기 버튼
    document.getElementById('monthly-ranking-back').addEventListener('click', async function() {
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
    
    // 새 계획 추가 버튼
    document.querySelector('.add-plan-btn').addEventListener('click', function() {
        showAddPlanPopup();
    });
    
    // 팝업 닫기
    document.querySelector('.cancel-btn').addEventListener('click', function() {
        hideAddPlanPopup();
    });
    
    // 계획 저장 (기존 이벤트 리스너 제거 후 새로 등록)
    const planForm = document.getElementById('plan-form');
    if (planForm) {
        // 기존 이벤트 리스너 제거
        planForm.removeEventListener('submit', handlePlanSubmit);
        // 새 이벤트 리스너 등록
        planForm.addEventListener('submit', handlePlanSubmit);
    }
    
    function handlePlanSubmit(e) {
        e.preventDefault();
        console.log('폼 제출 이벤트 발생');
        console.log('현재 프로필:', currentProfile);
        savePlan();
    }
    
    // 정렬 관련 설정 제거됨 - 최신순으로 고정
    
    // 캘린더 네비게이션 (단일 이벤트 리스너)
    document.querySelectorAll('.calendar-nav').forEach(btn => {
        btn.addEventListener('click', async function() {
            const direction = this.dataset.nav;
            await navigateMonth(direction);
        });
    });
    
    // 월별 랭킹 네비게이션
    document.querySelectorAll('.month-nav').forEach(btn => {
        btn.addEventListener('click', function() {
            const direction = this.dataset.nav;
            navigateMonthlyRanking(direction);
        });
    });
    
    // 차트 범위 버튼
    document.querySelectorAll('.chart-range-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.chart-range-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateRankingChart();
        });
    });
    
    // 앱 종료 버튼
    document.querySelector('.exit-btn').addEventListener('click', async function() {
        if (confirm('정말로 앱을 종료하시겠습니까?')) {
            await exitApp();
        }
    });
    
    // 앱 정보 버튼
    document.querySelector('.info-btn').addEventListener('click', function() {
        showAppInfo();
    });
}

// 앱 종료 함수 (PWA/모바일 최적화 - 강화 버전)
async function exitApp() {
    try {
        console.log('🚪 앱 종료 프로세스 시작...');
        
        // 1. 즉시 사용자에게 선택권 제공
        const userChoice = confirm(
            '앱 종료 방법을 선택해주세요:\n\n' +
            '확인: 자동 종료 시도\n' +
            '취소: 수동 종료 안내'
        );
        
        // 2. 데이터 저장 (안전하게)
        try {
            const currentData = await loadData();
            if (currentData) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
                console.log('✅ 최종 데이터 저장 완료');
            }
        } catch (error) {
            console.warn('⚠️ 데이터 저장 실패:', error);
        }
        
        // 3. 세션 정리
        currentProfile = null;
        exercisePlan = [];
        selectedPlan = null;
        
        if (userChoice) {
            // 자동 종료 시도
            showMessage('앱을 종료 중입니다...', false);
            
            // 즉시 여러 방법 동시 시도
            const exitPromises = [];
            
            // 방법 1: window.close() (즉시)
            try {
                console.log('🚪 window.close() 즉시 시도');
                window.close();
            } catch (e) {}
            
            // 방법 2: 히스토리 조작 (즉시)
            try {
                if (window.history.length > 1) {
                    console.log('📱 히스토리 뒤로 가기');
                    window.history.go(-window.history.length + 1);
                    window.history.back();
                }
            } catch (e) {}
            
            // 방법 3: location 조작들 (순차적)
            setTimeout(() => {
                try {
                    console.log('🔄 location.replace 시도');
                    window.location.replace('about:blank');
                } catch (e) {}
            }, 500);
            
            setTimeout(() => {
                try {
                    console.log('🔄 location.href 시도');
                    window.location.href = 'javascript:void(0);';
                } catch (e) {}
            }, 1000);
            
            setTimeout(() => {
                try {
                    console.log('🔄 빈 페이지 로드');
                    document.open();
                    document.write('');
                    document.close();
                } catch (e) {}
            }, 1500);
            
            // 방법 4: Android 특화
            setTimeout(() => {
                try {
                    if (navigator.app && navigator.app.exitApp) {
                        console.log('📱 Android exitApp() 시도');
                        navigator.app.exitApp();
                    }
                    
                    // Cordova/PhoneGap 지원
                    if (window.device && navigator.app) {
                        navigator.app.exitApp();
                    }
                } catch (e) {}
            }, 2000);
            
            // 방법 5: 강제 언로드
            setTimeout(() => {
                try {
                    console.log('🚫 강제 언로드');
                    window.location = 'javascript:window.close();';
                } catch (e) {}
            }, 2500);
            
            // 최종 안내
            setTimeout(() => {
                alert(
                    '자동 종료에 실패했습니다.\n\n' +
                    '📱 Android: 홈 버튼 → 최근 앱에서 스와이프\n' +
                    '🍎 iOS: 홈 버튼 두 번 누르고 위로 스와이프\n' +
                    '💻 PC: 브라우저 탭 닫기 (Ctrl+W)'
                );
            }, 3000);
            
        } else {
            // 수동 종료 안내
            const userAgent = navigator.userAgent.toLowerCase();
            let instructions = '';
            
            if (userAgent.includes('android')) {
                instructions = 
                    '📱 Android 앱 종료 방법:\n\n' +
                    '1. 홈 버튼을 누르세요\n' +
                    '2. 최근 앱 버튼을 누르세요\n' +
                    '3. 이 앱을 위로 스와이프하세요\n\n' +
                    '또는 뒤로 가기 버튼을 여러 번 누르세요';
            } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
                instructions = 
                    '🍎 iOS 앱 종료 방법:\n\n' +
                    '1. 홈 버튼을 두 번 빠르게 누르세요\n' +
                    '   (또는 화면 하단에서 위로 스와이프)\n' +
                    '2. 이 앱을 위로 스와이프하세요';
            } else {
                instructions = 
                    '💻 PC 브라우저 종료 방법:\n\n' +
                    '1. Ctrl + W (탭 닫기)\n' +
                    '2. Alt + F4 (창 닫기)\n' +
                    '3. 브라우저 X 버튼 클릭';
            }
            
            alert(instructions);
        }
        
    } catch (error) {
        console.error('❌ 앱 종료 프로세스 실패:', error);
        alert(
            '앱 종료 오류가 발생했습니다.\n' +
            '홈 버튼을 눌러 앱을 종료해주세요.'
        );
    }
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
    
    // 정렬 드롭다운 제거됨 - 최신순으로 고정
    
    // 캘린더 초기화 (첫 방문 시에도 제대로 표시되도록)
    currentDate = new Date();
    await updateCalendar();
    
    // AI 동기부여 기능 초기화
    initMotivationFeature();
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
    try {
        console.log('🔧 savePlan 함수 시작, currentProfile:', currentProfile);
        
        // 현재 프로필 검증
        if (!currentProfile) {
            alert('프로필이 선택되지 않았습니다. 프로필을 먼저 선택해주세요.');
            return;
        }
        
        const exerciseType = document.getElementById('exercise-type').value;
        const exerciseContent = document.getElementById('exercise-content').value;
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        console.log('📝 폼 데이터:', { exerciseType, exerciseContent, startDate, endDate });
        
        // 필수 필드 검증
        if (!exerciseType || !exerciseContent || !startDate || !endDate) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        
        // 날짜 검증
        if (new Date(startDate) > new Date(endDate)) {
            alert('시작 날짜는 종료 날짜보다 빨라야 합니다.');
            return;
        }
        
        const plan = {
            id: Date.now(),
            exercise_type: exerciseType,
            exercise_content: exerciseContent,
            start_date: startDate,
            end_date: endDate,
            completed_dates: [],
            created_date: new Date().toLocaleString('ko-KR')
        };
        
        console.log('새 계획 생성:', plan);
        
        // 데이터 저장
        console.log('📊 데이터 로드 시작...');
        const data = await loadData();
        console.log('📊 데이터 로드 완료:', data);
        
        // 데이터 구조 안전성 검증
        if (!data || !data.profiles) {
            console.error('❌ 잘못된 데이터 구조:', data);
            throw new Error('데이터 구조가 올바르지 않습니다.');
        }
        
        if (!data.profiles[currentProfile]) {
            console.log('🆕 새 프로필 데이터 생성:', currentProfile);
            data.profiles[currentProfile] = { 
                exercisePlans: [], 
                monthlyData: {},
                score: 0, 
                completedCount: 0 
            };
        }
        
        // 기존 exercisePlans에도 저장 (하위 호환성)
        console.log('📝 기존 exercisePlans에 추가...');
        if (!Array.isArray(data.profiles[currentProfile].exercisePlans)) {
            data.profiles[currentProfile].exercisePlans = [];
        }
        data.profiles[currentProfile].exercisePlans.push(plan);
        console.log('✅ exercisePlans 추가 완료');
        
        // 현재 월별 데이터에도 저장
        const currentMonth = getCurrentMonthKey();
        console.log('📅 현재 월:', currentMonth);
        
        try {
            const monthlyData = getMonthlyData(data.profiles[currentProfile], currentMonth);
            console.log('📊 월별 데이터:', monthlyData);
            
            if (!Array.isArray(monthlyData.exercisePlans)) {
                monthlyData.exercisePlans = [];
            }
            monthlyData.exercisePlans.push(plan);
            console.log('✅ 월별 데이터에 계획 추가 완료');
        } catch (monthlyError) {
            console.error('❌ 월별 데이터 처리 중 오류:', monthlyError);
            // 월별 데이터 오류가 있어도 계속 진행
        }
        
        console.log('💾 데이터 저장 시작...');
        await saveData(data);
        console.log('✅ 데이터 저장 완료');
        
        // UI 업데이트
        console.log('UI 업데이트 시작');
        await updatePlansList();
        console.log('계획 목록 업데이트 완료');
        await updateRanking();
        console.log('랭킹 업데이트 완료');
        hideAddPlanPopup();
        console.log('팝업 숨김 완료');
    
        // Firebase 연결 상태에 따른 메시지
        if (isFirebaseAvailable) {
            showMessage('🔥 새 운동 계획이 가족에게 공유되었습니다!');
        } else {
            showMessage('📱 새 운동 계획이 추가되었습니다! (로컬 저장)');
        }
        
        console.log('운동계획 저장 완료:', plan);
        
    } catch (error) {
        console.error('계획 저장 중 오류:', error);
        alert('계획 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 계획 목록 업데이트 (최신순 고정)
async function updatePlansList() {
    const data = await loadData();
    const profileData = data.profiles[currentProfile] || { exercisePlans: [] };
    const plansList = document.getElementById('plans-list');
    
    plansList.innerHTML = '';
    
    if (profileData.exercisePlans.length === 0) {
        plansList.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: black; background: rgba(255,255,255,0.1); border-radius: 10px;">
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
            <div class="empty-state" style="text-align: center; padding: 40px; color: black; background: rgba(255,255,255,0.1); border-radius: 10px;">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">현재 진행 중인 운동 계획이 없습니다.</p>
                <p style="font-size: 1rem;">새 계획을 추가해보세요! 💪</p>
            </div>
        `;
        
        return;
    }
    
    // 시작일 기준 오름차순 정렬 (빠른 날짜부터)
    activePlans.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    
    // 정렬된 계획들 표시
    activePlans.forEach(plan => {
        const planElement = createPlanElement(plan);
        plansList.appendChild(planElement);
    });
}

// 정렬 함수들 제거됨 - 최신순으로 고정

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
        <div class="plan-progress" data-plan-id="${plan.id}" style="cursor: pointer; padding: 5px; border-radius: 4px; transition: background-color 0.2s; ${isInPeriod ? 'background-color: #f0f8ff;' : 'background-color: #f5f5f5;'}" 
             title="${isInPeriod ? (isCompletedToday ? '클릭하여 오늘 완료 취소' : '클릭하여 오늘 완료 처리') : '계획 기간이 아닙니다'}">
            완료: ${completedCount}/${totalDays}일 (${progressPercent}%) ${isInPeriod ? (isCompletedToday ? '✅' : '⭕') : '⏸️'}
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
    
    // 메뉴 버튼 이벤트 추가 (삭제 기능)
    const menuBtn = element.querySelector('.plan-menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', async function(e) {
            e.stopPropagation(); // 부모 클릭 이벤트 방지
            const planId = parseInt(this.dataset.planId);
            await showPlanDeleteConfirm(planId, plan);
        });
    }
    
    // 진행률 클릭 이벤트 추가 (완료/취소 처리)
    const progressElement = element.querySelector('.plan-progress');
    if (progressElement) {
        progressElement.addEventListener('click', async function(e) {
            e.stopPropagation(); // 부모 클릭 이벤트 방지
            
            // 계획 기간에 포함되는 경우에만 완료/취소 처리
            if (isInPeriod) {
                const planId = parseInt(this.dataset.planId);
                await toggleExerciseCompletion(planId);
            } else {
                alert('해당 계획의 기간이 아닙니다.');
            }
        });
    }
    
    // 계획 카드 클릭 이벤트 (완료 버튼, 진행률, 메뉴 버튼 제외)
    element.addEventListener('click', async function(e) {
        if (!e.target.classList.contains('complete-btn') && 
            !e.target.classList.contains('plan-progress') && 
            !e.target.classList.contains('plan-menu-btn')) {
            await showPlanCalendar(plan);
        }
    });
    
    return element;
}

// 운동계획 삭제 확인 팝업
async function showPlanDeleteConfirm(planId, plan) {
    const confirmMessage = `운동계획을 삭제하시겠습니까?\n\n${plan.exercise_type}: ${plan.exercise_content}\n기간: ${plan.start_date} ~ ${plan.end_date}\n\n⚠️ 삭제하면 계획 점수(-1점)가 차감됩니다.`;
    
    if (confirm(confirmMessage)) {
        await deletePlan(planId);
    }
}

// 운동계획 삭제 함수
async function deletePlan(planId) {
    try {
        const data = await loadData();
        const profileData = data.profiles[currentProfile];
        
        if (!profileData || !profileData.exercisePlans) {
            console.error('프로필 데이터가 없습니다.');
            return;
        }
        
        // 기존 exercisePlans에서 삭제
        const planIndex = profileData.exercisePlans.findIndex(plan => plan.id === planId);
        if (planIndex === -1) {
            console.error('삭제할 계획을 찾을 수 없습니다.');
            return;
        }
        
        profileData.exercisePlans.splice(planIndex, 1);
        
        // 월별 데이터에서도 삭제
        const currentMonth = getCurrentMonthKey();
        const monthlyData = getMonthlyData(profileData, currentMonth);
        if (monthlyData.exercisePlans) {
            const monthlyPlanIndex = monthlyData.exercisePlans.findIndex(plan => plan.id === planId);
            if (monthlyPlanIndex !== -1) {
                monthlyData.exercisePlans.splice(monthlyPlanIndex, 1);
            }
        }
        
        // 데이터 저장
        await saveData(data);
        
        // UI 업데이트
        await updatePlansList();
        await updateRanking();
        
        console.log('운동계획이 삭제되었습니다.');
        
    } catch (error) {
        console.error('계획 삭제 중 오류:', error);
        alert('계획 삭제 중 오류가 발생했습니다.');
    }
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
    
    if (!calendarTitle || !calendarGrid) {
        console.error('캘린더 DOM 요소를 찾을 수 없습니다!');
        return;
    }
    
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
                await showDateExerciseInfo(dateStr);
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

// 캘린더 그리드 생성 (성능 최적화)
async function createCalendarGrid(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 한 번에 모든 데이터 가져오기 (성능 최적화)
    const data = await loadData();
    const profileData = data.profiles[currentProfile];
    const exercisePlans = profileData?.exercisePlans || [];
    
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
    
    // 날짜 추가 (성능 최적화: 반복문에서 async 호출 제거)
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // 해당 날짜의 운동 상태 빠르게 확인
        let isCompleted = false;
        let hasExercise = false;
        
        for (const plan of exercisePlans) {
            if (dateStr >= plan.start_date && dateStr <= plan.end_date) {
                hasExercise = true;
                if (plan.completed_dates && plan.completed_dates.includes(dateStr)) {
                    isCompleted = true;
                }
            }
        }
        
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
    try {
        if (!currentProfile) return false;
        
        const data = await loadData();
        if (!data || !data.profiles) return false;
        
        const profileData = data.profiles[currentProfile];
        if (!profileData || !profileData.exercisePlans) return false;
        
        return profileData.exercisePlans.some(plan => {
            return plan.completed_dates && plan.completed_dates.includes(dateStr);
        });
    } catch (error) {
        console.error('isDateCompleted 에러:', error);
        return false;
    }
}

// 특정 날짜에 운동 계획이 있는지 확인
async function hasExerciseOnDate(dateStr) {
    try {
        if (!currentProfile) return false;
        
        const data = await loadData();
        if (!data || !data.profiles) return false;
        
        const profileData = data.profiles[currentProfile];
        if (!profileData || !profileData.exercisePlans) return false;
        
        return profileData.exercisePlans.some(plan => {
            return dateStr >= plan.start_date && dateStr <= plan.end_date;
        });
    } catch (error) {
        console.error('hasExerciseOnDate 에러:', error);
        return false;
    }
}

// 날짜 클릭 시 운동 내용 표시
async function showDateExerciseInfo(dateStr) {
    const data = await loadData();
    if (!data.profiles[currentProfile]) {
        showMessage('프로필 데이터가 없습니다.');
        return;
    }
    
    const profileData = data.profiles[currentProfile];
    if (!profileData.exercisePlans) {
        showMessage('운동 계획이 없습니다.');
        return;
    }
    
    // 해당 날짜에 해당하는 운동 계획들 찾기
    const plansForDate = profileData.exercisePlans.filter(plan => {
        return dateStr >= plan.start_date && dateStr <= plan.end_date;
    });
    
    if (plansForDate.length === 0) {
        showMessage(`${dateStr}에는 운동 계획이 없습니다.`);
        return;
    }
    
    // 운동 정보 팝업 생성
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    let plansHtml = '';
    plansForDate.forEach(plan => {
        const isCompleted = plan.completed_dates && plan.completed_dates.includes(dateStr);
        const completedStatus = isCompleted ? '✅ 완료됨' : '⭕ 미완료';
        const statusColor = isCompleted ? '#4caf50' : '#ff9800';
        
        plansHtml += `
            <div style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 10px; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: bold; color: #333;">${plan.exercise_type}</span>
                    <span style="color: ${statusColor}; font-size: 0.9rem; font-weight: bold;">${completedStatus}</span>
                </div>
                <div style="color: #666; margin-bottom: 8px;">${plan.exercise_content}</div>
                <div style="font-size: 0.8rem; color: #999;">
                    기간: ${plan.start_date} ~ ${plan.end_date}
                </div>
                <div style="margin-top: 10px; text-align: center;">
                    <button onclick="toggleExerciseForDate('${plan.id}', '${dateStr}', this.parentElement.parentElement.parentElement.parentElement)" 
                            style="background: ${isCompleted ? '#f44336' : '#4caf50'}; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;">
                        ${isCompleted ? '완료 취소' : '완료 처리'}
                    </button>
                </div>
            </div>
        `;
    });
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white; 
        border-radius: 15px; 
        padding: 20px; 
        max-width: 400px; 
        width: 90%; 
        max-height: 80vh; 
        overflow-y: auto;
        position: relative;
    `;
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 5px 0;">📅 ${dateStr}</h3>
            <p style="color: #666; margin: 0; font-size: 0.9rem;">${plansForDate.length}개 운동 계획</p>
        </div>
        ${plansHtml}
        <div style="text-align: center; margin-top: 20px;">
            <button id="close-modal-btn" 
                    style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                닫기
            </button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 닫기 이벤트 리스너 추가
    const closeBtn = modalContent.querySelector('#close-modal-btn');
    const closeModal = () => {
        modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    
    // 배경 클릭시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // ESC 키로 닫기
    const handleKeyPress = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleKeyPress);
        }
    };
    document.addEventListener('keydown', handleKeyPress);
}

// 특정 날짜의 운동 완료/취소 토글 (팝업에서 사용)
async function toggleExerciseForDate(planId, dateStr, modalElement) {
    try {
        const data = await loadData();
        const profileData = data.profiles[currentProfile];
        const plan = profileData.exercisePlans.find(p => p.id == planId);
        
        if (!plan) {
            alert('운동 계획을 찾을 수 없습니다.');
            return;
        }
        
        if (!plan.completed_dates) plan.completed_dates = [];
        
        const dateIndex = plan.completed_dates.indexOf(dateStr);
        const exerciseScore = getExerciseScore(plan.exercise_type);
        
        if (dateIndex > -1) {
            // 완료 취소
            plan.completed_dates.splice(dateIndex, 1);
            showMessage(`${plan.exercise_type} 완료를 취소했습니다! (-${exerciseScore}점)`);
        } else {
            // 완료 처리
            plan.completed_dates.push(dateStr);
            showMessage(`${plan.exercise_type} 완료! +${exerciseScore}점 획득! 🎉`);
        }
        
        await saveData(data);
        
        // 팝업 닫기 및 UI 업데이트
        modalElement.remove();
        await updateCalendar();
        await updateCurrentProfileInfo();
        await updateRanking();
        
    } catch (error) {
        console.error('운동 완료 토글 중 오류:', error);
        alert('처리 중 오류가 발생했습니다.');
    }
}

// 전역 함수로 노출
if (typeof window !== 'undefined') {
    window.toggleExerciseForDate = toggleExerciseForDate;
}



// 랭킹 업데이트 - 개선된 버전
async function updateRanking() {
    console.log('🏆 랭킹 업데이트 시작...');
    
    const data = await loadData();
    const rankings = [];
    
    // 기본 프로필들 추가
    const profiles = ['아빠', '엄마', '주환', '태환'];
    for (const profile of profiles) {
        const score = calculateProfileScore(profile, data.profiles[profile]);
        
        // 계급 계산 (updateProfileCards와 동일한 로직)
        let grade = '⛓️ 노예';
        if (score >= 400) grade = '✨ 신';
        else if (score >= 300) grade = '👑 왕';
        else if (score >= 200) grade = '🛡️ 백작';
        else if (score >= 120) grade = '🏇 기사';
        else if (score >= 50) grade = '🌾 농민';
        
        rankings.push({ 
            name: profile, 
            score: score,
            grade: grade 
        });
    }
    
    rankings.sort((a, b) => b.score - a.score);
    
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    
    // 실제 등수 계산 (같은 점수면 같은 등수)
    let currentRank = 1;
    let previousScore = null;
    
    // 모든 점수가 0점인지 확인
    const allScoresZero = rankings.every(item => item.score === 0);
    
    rankings.forEach((item, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        // 모든 점수가 0점이면 모두 1등으로 표시
        if (allScoresZero) {
            currentRank = 1;
        } else {
            // 같은 점수가 아니면 등수 업데이트
            if (previousScore !== null && item.score !== previousScore) {
                currentRank = index + 1;
            }
        }
        previousScore = item.score;
        
        const rankNumber = currentRank;
        const imgSrc = getProfileImageSrc(item.name);
        
        // 실제 등수에 따른 배경색과 테두리색 (1위는 여러 명일 수 있음)
        let bgColor = '#f8f9fa';
        let borderColor = '#4CAF50'; // 기본색
        
        if (currentRank === 1) {
            bgColor = '#fff3cd'; // 1위 - 골드
            borderColor = '#FFD700';
        } else if (currentRank === 2) {
            bgColor = '#e2e3e5'; // 2위 - 실버
            borderColor = '#C0C0C0';
        } else if (currentRank === 3) {
            bgColor = '#f8d7da'; // 3위 - 브론즈
            borderColor = '#CD7F32';
        }
        
        // 트로피 아이콘 선택
        let trophyIcon = '';
        if (currentRank === 1) {
            trophyIcon = '🏆'; // 금 트로피
        } else if (currentRank === 2) {
            trophyIcon = '🥈'; // 은메달
        } else if (currentRank === 3) {
            trophyIcon = '🥉'; // 동메달
        } else {
            trophyIcon = '🏅'; // 일반 메달
        }
        
        rankingItem.innerHTML = `
            <div class="rank-profile-container" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                <div class="rank-image-wrapper" style="position: relative; margin-bottom: 8px;">
                    <img src="${imgSrc}" alt="${item.name}" 
                         style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 3px solid ${borderColor}; box-shadow: 0 4px 8px rgba(0,0,0,0.2);"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div style="display: none; width: 60px; height: 60px; border-radius: 50%; background: #007bff; color: white; justify-content: center; align-items: center; font-size: 1.5rem; border: 3px solid ${borderColor};">
                        ${item.name === '아빠' ? '👨' : item.name === '엄마' ? '👩' : item.name === '주환' ? '👦' : '🧒'}
                    </div>
                    <div class="rank-badge" style="position: absolute; top: -5px; left: -5px; width: 20px; height: 20px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; border: 2px solid ${borderColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                        ${trophyIcon}
                    </div>
                    <div class="grade-badge" style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.6rem; font-weight: bold; border: 1px solid white;">
                        ${item.grade.split(' ')[0]}
                    </div>
                </div>
                <div class="rank-info" style="text-align: center;">
                    <div style="font-weight: bold; font-size: 0.9rem; color: #333; margin-bottom: 2px;">
                        ${item.name}
                    </div>
                    <div style="font-size: 0.8rem; color: #666;">
                        ${item.score}점
                    </div>
                </div>
            </div>
        `;
        
        rankingList.appendChild(rankingItem);
    });
}

// 프로필 카드 정보 업데이트 - 개선된 버전
async function updateProfileCards() {
    const profiles = ['아빠', '엄마', '주환', '태환'];
    const data = await loadData();
    
    console.log('🔄 프로필 카드 업데이트 시작...');
    
    // 각 프로필별 점수 계산
    const rankings = [];
    for (const profile of profiles) {
        const score = calculateProfileScore(profile, data.profiles[profile]);
        
        // 계급 계산
        let grade = '⛓️ 노예';
        if (score >= 400) grade = '✨ 신';
        else if (score >= 300) grade = '👑 왕';
        else if (score >= 200) grade = '🛡️ 백작';
        else if (score >= 120) grade = '🏇 기사';
        else if (score >= 50) grade = '🌾 농민';
        
        rankings.push({ 
            name: profile, 
            score: score,
            grade: grade 
        });
        
        console.log(`📊 ${profile}: ${score}점, ${grade}`);
    }
    
    rankings.sort((a, b) => b.score - a.score);
    
    // 등수 계산
    let currentRank = 1;
    let previousScore = null;
    const allScoresZero = rankings.every(item => item.score === 0);
    
    const rankMap = {};
    rankings.forEach((item, index) => {
        // 모든 점수가 0점이면 모두 1등으로 표시
        if (allScoresZero) {
            currentRank = 1;
        } else {
            // 같은 점수가 아니면 등수 업데이트
            if (previousScore !== null && item.score !== previousScore) {
                currentRank = index + 1;
            }
        }
        previousScore = item.score;
        rankMap[item.name] = currentRank;
    });
    
    // 프로필 카드 업데이트
    for (const ranking of rankings) {
        const profileName = ranking.name;
        const profileCard = document.querySelector(`[data-profile="${profileName}"]`);
        
        if (profileCard) {
            const gradeElement = profileCard.querySelector('.grade');
            const scoreElement = profileCard.querySelector('.score');
            const rankBadge = profileCard.querySelector('.rank-badge');
            
            // 계산된 점수와 계급 직접 사용
            if (gradeElement) gradeElement.textContent = ranking.grade;
            if (scoreElement) scoreElement.textContent = `${ranking.score}점`;
            if (rankBadge) {
                const rank = rankMap[profileName] || 1;
                let trophyIcon = '';
                if (rank === 1) {
                    trophyIcon = '🏆';
                } else if (rank === 2) {
                    trophyIcon = '🥈';
                } else if (rank === 3) {
                    trophyIcon = '🥉';
                } else {
                    trophyIcon = '🏅';
                }
                rankBadge.textContent = trophyIcon;
                rankBadge.style.fontSize = '2.4rem';
            }
            
            console.log(`✅ ${profileName} 카드 업데이트: ${ranking.score}점, ${ranking.grade}, ${rankMap[profileName]}등`);
        } else {
            console.warn(`⚠️ ${profileName} 프로필 카드를 찾을 수 없습니다.`);
        }
    }
    
    console.log('✅ 프로필 카드 업데이트 완료');
}

// 프로필 점수 계산 - 개선된 버전 (전체 운동 이력 기반)
function calculateProfileScore(profileName, profileData) {
    if (!profileData) {
        console.log(`❌ ${profileName}: 프로필 데이터 없음`);
        return 0;
    }
    
    let completionScore = 0;
    let planScore = 0;
    
    // 모든 운동 계획에서 완료된 운동들의 점수 계산
    if (profileData.exercisePlans && Array.isArray(profileData.exercisePlans)) {
        console.log(`📊 ${profileName}: 총 ${profileData.exercisePlans.length}개 운동 계획 확인`);
        
        profileData.exercisePlans.forEach(plan => {
            // 완료된 운동 횟수만큼 점수 획득
            if (plan.completed_dates && Array.isArray(plan.completed_dates)) {
                const completedCount = plan.completed_dates.length;
                const exerciseScore = getExerciseScore(plan.exercise_type);
                const planCompletionScore = completedCount * exerciseScore;
                
                completionScore += planCompletionScore;
                
                console.log(`  📝 ${plan.exercise_type}: ${completedCount}회 완료 × ${exerciseScore}점 = ${planCompletionScore}점`);
            }
            
            // 계획 보너스 점수 (계획 1개당 1점)
            planScore += 1;
        });
        
        console.log(`📊 ${profileName} 점수 계산 상세:`);
        console.log(`  - 완료 점수: ${completionScore}점`);
        console.log(`  - 계획 보너스: ${planScore}점`);
        console.log(`  - 총합: ${completionScore + planScore}점`);
    } else {
        console.log(`❌ ${profileName}: 운동 계획 배열이 없음 또는 잘못된 형태`);
    }
    
    const totalScore = completionScore + planScore;
    console.log(`🏆 ${profileName} 최종 점수: ${totalScore}점`);
    
    return totalScore;
}

// 현재 월 키 생성 (예: "2025-01")
function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 월별 데이터 가져오기/생성
function getMonthlyData(profileData, monthKey) {
    if (!profileData.monthlyData) {
        profileData.monthlyData = {};
    }
    
    if (!profileData.monthlyData[monthKey]) {
        profileData.monthlyData[monthKey] = {
            exercisePlans: [],
            score: 0,
            completedCount: 0
        };
    }
    
    return profileData.monthlyData[monthKey];
}

// 월별 랭킹 초기화 확인 및 처리
async function checkAndPerformMonthlyReset() {
    const now = new Date();
    const currentMonth = getCurrentMonthKey();
    const currentDate = now.getDate();
    
    // 매월 1일에만 초기화 실행
    if (currentDate !== 1) {
        return false;
    }
    
    const lastResetMonth = localStorage.getItem('lastResetMonth');
    
    // 이번 달에 이미 초기화했는지 확인
    if (lastResetMonth === currentMonth) {
        return false;
    }
    
    console.log(`🗓️ 새로운 달 시작: ${currentMonth}, 월별 랭킹 초기화 시작...`);
    
    try {
        // 데이터 로드
        const data = await loadData();
        let hasChanges = false;
        
        // 모든 프로필의 이전 달 데이터 정리
        const profiles = ['아빠', '엄마', '주환', '태환'];
        for (const profileName of profiles) {
            const profileData = data.profiles[profileName];
            if (!profileData) continue;
            
            // 이전 달 계획들을 completed 상태로 이동 (기록 보존)
            if (profileData.exercisePlans && profileData.exercisePlans.length > 0) {
                const yesterday = new Date(now);
                yesterday.setDate(0); // 이전 달 마지막 날
                const previousMonth = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}`;
                
                // 이전 달에 종료된 계획들을 완료된 계획으로 이동
                const expiredPlans = profileData.exercisePlans.filter(plan => 
                    plan.end_date < currentMonth.slice(0, 7) + '-01' // 이번 달 1일보다 이전에 종료
                );
                
                if (expiredPlans.length > 0) {
                    // 이전 달 월별 데이터에 완료된 계획들 저장
                    const previousMonthData = getMonthlyData(profileData, previousMonth);
                    expiredPlans.forEach(plan => {
                        const exists = previousMonthData.exercisePlans.find(p => p.id === plan.id);
                        if (!exists) {
                            previousMonthData.exercisePlans.push(plan);
                        }
                    });
                    
                    // 현재 계획 목록에서 만료된 계획들 제거
                    profileData.exercisePlans = profileData.exercisePlans.filter(plan => 
                        plan.end_date >= currentMonth.slice(0, 7) + '-01'
                    );
                    
                    hasChanges = true;
                    console.log(`${profileName}: ${expiredPlans.length}개 만료된 계획을 이전 달로 이동`);
                }
            }
            
            // 새 달 월별 데이터 초기화
            const currentMonthData = getMonthlyData(profileData, currentMonth);
            if (!currentMonthData || Object.keys(currentMonthData).length === 0) {
                profileData.monthlyData[currentMonth] = {
                    exercisePlans: [],
                    score: 0,
                    completedCount: 0,
                    resetDate: now.toISOString()
                };
                hasChanges = true;
                console.log(`${profileName}: 새 달 데이터 초기화`);
            }
        }
        
        // 변경사항이 있으면 저장
        if (hasChanges) {
            await saveData(data);
            console.log('✅ 월별 데이터 정리 및 초기화 완료');
        }
        
        // 초기화 완료 표시
        localStorage.setItem('lastResetMonth', currentMonth);
        
        // 사용자에게 알림
        showMessage(`🎉 새로운 달이 시작되었습니다! (${currentMonth})\n🏆 랭킹이 초기화되었습니다.`, false);
        
        return true;
        
    } catch (error) {
        console.error('❌ 월별 초기화 중 오류:', error);
        return false;
    }
}

// 기존 checkMonthlyReset 함수 (하위 호환성)
function checkMonthlyReset() {
    return checkAndPerformMonthlyReset();
}

// 수동 월별 초기화 (개발/테스트용)
async function forceMonthlyReset() {
    console.log('🔧 수동 월별 초기화 실행...');
    
    // 강제로 초기화 실행
    localStorage.removeItem('lastResetMonth');
    
    const success = await checkAndPerformMonthlyReset();
    if (success) {
        console.log('✅ 수동 월별 초기화 완료');
        // UI 강제 업데이트
        await updateRanking();
        await updateProfileCards();
        if (currentProfile) {
            await updatePlansList();
        }
    } else {
        console.warn('⚠️ 수동 월별 초기화 실패');
    }
    
    return success;
}

// 개발자 도구용 - 전역 함수로 노출
if (typeof window !== 'undefined') {
    window.forceMonthlyReset = forceMonthlyReset;
    window.showCurrentMonthData = function() {
        const currentMonth = getCurrentMonthKey();
        console.log('현재 월:', currentMonth);
        
        loadData().then(data => {
            console.log('전체 데이터:', data);
            
            ['아빠', '엄마', '주환', '태환'].forEach(profile => {
                const profileData = data.profiles[profile];
                if (profileData) {
                    const score = calculateProfileScore(profile, profileData);
                    console.log(`${profile}: ${score}점`);
                    
                    const monthlyData = getMonthlyData(profileData, currentMonth);
                    console.log(`${profile} 월별 데이터:`, monthlyData);
                }
            });
        });
    };
}

// 기존 계획들을 월별 데이터로 마이그레이션
async function migrateExistingPlansToMonthly() {
    try {
        console.log('🔄 마이그레이션 시작: 기존 계획들을 월별 데이터로 변환');
        const data = await loadData();
        
        if (!data || !data.profiles) {
            console.log('📝 데이터가 없음 - 마이그레이션 건너뜀');
            return false;
        }
        
        let hasChanges = false;
        const profiles = ['아빠', '엄마', '주환', '태환'];
        
        for (const profileName of profiles) {
            const profileData = data.profiles[profileName];
            if (!profileData) {
                console.log(`⚠️ ${profileName} 프로필 데이터 없음`);
                continue;
            }
            
            if (!profileData.exercisePlans || !Array.isArray(profileData.exercisePlans)) {
                console.log(`⚠️ ${profileName} 운동 계획 데이터 없음`);
                continue;
            }
            
            // monthlyData가 없으면 초기화
            if (!profileData.monthlyData) {
                profileData.monthlyData = {};
                hasChanges = true;
            }
            
            // 각 계획을 해당 월별 데이터에 추가
            profileData.exercisePlans.forEach(plan => {
                // 계획 시작 날짜의 월 키 생성
                const planStartDate = new Date(plan.start_date);
                const planMonth = `${planStartDate.getFullYear()}-${String(planStartDate.getMonth() + 1).padStart(2, '0')}`;
                
                // 해당 월 데이터가 없으면 생성
                if (!profileData.monthlyData[planMonth]) {
                    profileData.monthlyData[planMonth] = {
                        exercisePlans: [],
                        score: 0,
                        completedCount: 0
                    };
                    hasChanges = true;
                }
                
                // 이미 해당 월에 이 계획이 있는지 확인
                const existingPlan = profileData.monthlyData[planMonth].exercisePlans.find(p => p.id === plan.id);
                if (!existingPlan) {
                    profileData.monthlyData[planMonth].exercisePlans.push(plan);
                    hasChanges = true;
                    console.log(`${profileName} - ${planMonth}월에 계획 추가:`, plan.exercise_type);
                }
            });
        }
        
        if (hasChanges) {
            await saveData(data);
            console.log('기존 계획들을 월별 데이터로 마이그레이션 완료');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('마이그레이션 중 오류:', error);
        return false;
    }
}

// 운동 종류별 점수
function getExerciseScore(exerciseType) {
    const scores = {
        '러닝': 15,
        '달리기': 15,  // 기존 데이터 호환성
        '러닝머신': 15,
        '수영': 20,
        '자전거': 12,
        '기구운동': 18,
        '요가': 10,
        '걷기': 8,
        '야구': 10,    // 15점에서 10점으로 변경
        '축구': 10,    // 15점에서 10점으로 변경
        '농구': 10,    // 새로 추가
        '기타': 5
    };
    return scores[exerciseType] || 5;
}

// 월별 랭킹 화면 표시
let selectedMonthDate = new Date();

function showMonthlyRankingScreen() {
    selectedMonthDate = new Date(); // 현재 월로 초기화
    showScreen('monthly-ranking-screen');
    updateMonthlyRankingData();
}

// 월별 랭킹 데이터 업데이트
async function updateMonthlyRankingData() {
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth() + 1;
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    
    // 월 제목 업데이트
    document.getElementById('selected-month-title').textContent = `${year}년 ${month}월`;
    
    try {
        const data = await loadData();
        
        // 해당 월 데이터 수집
        const monthlyScores = {};
        const monthlyExercises = {};
        let totalExerciseCount = 0;
        let champion = '-';
        let maxScore = 0;
        
        // 각 프로필의 월별 데이터 계산
        Object.keys(data.profiles).forEach(profileName => {
            const profile = data.profiles[profileName];
            let monthScore = 0;
            let exerciseCount = 0;
            
            // monthlyData에서 해당 월 데이터 찾기
            if (profile.monthlyData && profile.monthlyData[monthKey]) {
                const monthData = profile.monthlyData[monthKey];
                monthScore = monthData.score || 0;
                exerciseCount = monthData.completedExercises ? monthData.completedExercises.length : 0;
            }
            
            // 활성 계획에서 해당 월의 완료 기록도 확인 (월별 초기화가 안된 경우 대비)
            if (profile.exercisePlans) {
                profile.exercisePlans.forEach(plan => {
                    if (plan.completed_dates) {
                        plan.completed_dates.forEach(dateStr => {
                            const planDate = new Date(dateStr);
                            if (planDate.getFullYear() === year && planDate.getMonth() + 1 === month) {
                                // monthlyData에 이미 포함되지 않은 경우만 추가
                                const isAlreadyInMonthlyData = profile.monthlyData && 
                                    profile.monthlyData[monthKey] && 
                                    profile.monthlyData[monthKey].completedExercises &&
                                    profile.monthlyData[monthKey].completedExercises.some(ex => 
                                        ex.date === dateStr && ex.planId === plan.id
                                    );
                                
                                if (!isAlreadyInMonthlyData) {
                                    monthScore += getExerciseScore(plan.exercise_type);
                                    exerciseCount++;
                                }
                            }
                        });
                    }
                });
            }
            
            monthlyScores[profileName] = monthScore;
            monthlyExercises[profileName] = exerciseCount;
            totalExerciseCount += exerciseCount;
            
            if (monthScore > maxScore) {
                maxScore = monthScore;
                champion = profileName;
            }
        });
        
        // 통계 요약 업데이트
        document.getElementById('monthly-champion').textContent = champion;
        document.getElementById('total-exercises').textContent = `${totalExerciseCount}회`;
        
        // 랭킹 리스트 생성
        const rankingItems = Object.keys(monthlyScores)
            .map(name => ({
                name,
                score: monthlyScores[name],
                exercises: monthlyExercises[name]
            }))
            .sort((a, b) => b.score - a.score);
        
        updateMonthlyRankingList(rankingItems);
        updateRankingChart();
        updateMonthlyDetails(rankingItems, monthKey);
        
    } catch (error) {
        console.error('월별 랭킹 데이터 로드 중 오류:', error);
    }
}

// 월별 랭킹 리스트 업데이트
function updateMonthlyRankingList(rankingItems) {
    const container = document.getElementById('monthly-ranking-items');
    container.innerHTML = '';
    
    rankingItems.forEach((item, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
        
        const trophyIcon = rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
        
        const imgSrc = getProfileImageSrc(item.name);
        
        const rankingItem = document.createElement('div');
        rankingItem.className = 'monthly-ranking-item';
        
        rankingItem.innerHTML = `
            <div class="monthly-rank-position ${rankClass}">
                ${trophyIcon}
            </div>
            <div class="monthly-member-info">
                <img src="${imgSrc}" alt="${item.name}" class="monthly-member-avatar" 
                     onerror="this.style.display='none'">
                <div class="monthly-member-name">${item.name}</div>
            </div>
            <div class="monthly-member-stats">
                <div class="monthly-score">${item.score}점</div>
                <div class="monthly-exercises">${item.exercises}회</div>
            </div>
        `;
        
        container.appendChild(rankingItem);
    });
}

// 랭킹 차트 업데이트 (꺾은선 그래프)
async function updateRankingChart() {
    try {
        const data = await loadData();
        const activeBtn = document.querySelector('.chart-range-btn.active');
        const months = activeBtn.id === 'chart-range-12' ? 12 : 6;
        
        // 차트 데이터 수집
        const chartData = await collectChartData(data, months);
        
        // 차트 렌더링
        renderRankingChart(chartData);
        
        // 범례 업데이트
        updateChartLegend();
        
    } catch (error) {
        console.error('랭킹 차트 업데이트 중 오류:', error);
    }
}

// 차트 데이터 수집
async function collectChartData(data, monthsCount) {
    const currentDate = new Date();
    const chartData = {
        months: [],
        members: {
            '아빠': [],
            '엄마': [],
            '주환': [],
            '태환': []
        }
    };
    
    // 지정된 개월 수만큼 과거 데이터 수집
    for (let i = monthsCount - 1; i >= 0; i--) {
        const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        
        // 월 라벨 추가
        chartData.months.push(`${month}월`);
        
        // 각 멤버의 해당 월 랭킹 계산
        const monthlyScores = {};
        
        Object.keys(data.profiles).forEach(profileName => {
            const profile = data.profiles[profileName];
            let monthScore = 0;
            
            // monthlyData에서 해당 월 데이터 찾기
            if (profile.monthlyData && profile.monthlyData[monthKey]) {
                monthScore = profile.monthlyData[monthKey].score || 0;
            }
            
            // 활성 계획에서 해당 월의 완료 기록도 확인 (월별 초기화가 안된 경우 대비)
            if (profile.exercisePlans) {
                profile.exercisePlans.forEach(plan => {
                    if (plan.completed_dates) {
                        plan.completed_dates.forEach(dateStr => {
                            const planDate = new Date(dateStr);
                            if (planDate.getFullYear() === year && planDate.getMonth() + 1 === month) {
                                // monthlyData에 이미 포함되지 않은 경우만 추가
                                const isAlreadyInMonthlyData = profile.monthlyData && 
                                    profile.monthlyData[monthKey] && 
                                    profile.monthlyData[monthKey].completedExercises &&
                                    profile.monthlyData[monthKey].completedExercises.some(ex => 
                                        ex.date === dateStr && ex.planId === plan.id
                                    );
                                
                                if (!isAlreadyInMonthlyData) {
                                    monthScore += getExerciseScore(plan.exercise_type);
                                }
                            }
                        });
                    }
                });
            }
            
            monthlyScores[profileName] = monthScore;
        });
        
        // 점수별 랭킹 계산
        const sortedMembers = Object.keys(monthlyScores)
            .map(name => ({ name, score: monthlyScores[name] }))
            .sort((a, b) => b.score - a.score);
        
        // 각 멤버의 랭킹 저장 (동점 처리)
        Object.keys(chartData.members).forEach(memberName => {
            let rank = 1;
            for (let j = 0; j < sortedMembers.length; j++) {
                if (sortedMembers[j].name === memberName) {
                    rank = j + 1;
                    break;
                }
                // 동점인 경우 같은 순위
                if (j > 0 && sortedMembers[j].score === sortedMembers[j-1].score) {
                    rank = j; // 이전 순위와 동일
                } else {
                    rank = j + 1;
                }
            }
            
            // 점수가 0인 경우 랭킹을 4위로 설정
            if (monthlyScores[memberName] === 0) {
                rank = 4;
            }
            
            chartData.members[memberName].push(rank);
        });
    }
    
    return chartData;
}

// 차트 렌더링
function renderRankingChart(chartData) {
    const svg = document.getElementById('ranking-chart-svg');
    const xAxisContainer = document.getElementById('chart-x-axis');
    
    // SVG 초기화
    svg.innerHTML = '';
    xAxisContainer.innerHTML = '';
    
    if (chartData.months.length === 0) {
        svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#666" font-size="14">데이터가 없습니다</text>';
        return;
    }
    
    const svgRect = svg.getBoundingClientRect();
    const width = svgRect.width - 40; // 좌우 여백
    const height = svgRect.height - 40; // 상하 여백
    const startX = 20;
    const startY = 20;
    
    // 그리드 라인 그리기
    for (let i = 1; i <= 4; i++) {
        const y = startY + (height / 4) * (i - 1);
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('x1', startX);
        gridLine.setAttribute('y1', y);
        gridLine.setAttribute('x2', startX + width);
        gridLine.setAttribute('y2', y);
        gridLine.setAttribute('class', 'chart-grid-line');
        svg.appendChild(gridLine);
    }
    
    // X축 라벨 추가
    chartData.months.forEach((month, index) => {
        const label = document.createElement('div');
        label.className = 'x-axis-label';
        label.textContent = month;
        label.style.flex = '1';
        label.style.textAlign = 'center';
        xAxisContainer.appendChild(label);
    });
    
    // 각 멤버의 선 그리기
    Object.keys(chartData.members).forEach(memberName => {
        const rankings = chartData.members[memberName];
        if (rankings.length === 0) return;
        
        // 선 그리기
        let pathData = '';
        const points = [];
        
        rankings.forEach((rank, index) => {
            const x = startX + (width / (chartData.months.length - 1)) * index;
            const y = startY + (height / 4) * (rank - 1);
            
            points.push({ x, y, rank, month: chartData.months[index] });
            
            if (index === 0) {
                pathData += `M ${x} ${y}`;
            } else {
                pathData += ` L ${x} ${y}`;
            }
        });
        
        // 선 요소 생성
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('class', `chart-line member-${memberName}`);
        svg.appendChild(path);
        
        // 점 그리기
        points.forEach(point => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('class', `chart-point member-${memberName}`);
            circle.setAttribute('data-member', memberName);
            circle.setAttribute('data-rank', point.rank);
            circle.setAttribute('data-month', point.month);
            
            // 호버 이벤트
            circle.addEventListener('mouseenter', function() {
                showChartTooltip(this, memberName, point.rank, point.month);
            });
            circle.addEventListener('mouseleave', hideChartTooltip);
            
            svg.appendChild(circle);
        });
    });
}

// 차트 범례 업데이트
function updateChartLegend() {
    const legendContainer = document.getElementById('chart-legend');
    legendContainer.innerHTML = '';
    
    const members = ['아빠', '엄마', '주환', '태환'];
    
    members.forEach(member => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        legendItem.innerHTML = `
            <div class="legend-color member-${member}"></div>
            <span>${member}</span>
        `;
        
        legendContainer.appendChild(legendItem);
    });
}

// 차트 툴팁 표시
function showChartTooltip(element, member, rank, month) {
    // 간단한 타이틀 속성으로 툴팁 표시
    element.setAttribute('title', `${member}: ${month} ${rank}위`);
}

// 차트 툴팁 숨기기
function hideChartTooltip(element) {
    if (element && element.removeAttribute) {
        element.removeAttribute('title');
    }
}

// 월별 상세 정보 업데이트
function updateMonthlyDetails(rankingItems, monthKey) {
    const container = document.getElementById('monthly-details-content');
    container.innerHTML = '';
    
    const totalScore = rankingItems.reduce((sum, item) => sum + item.score, 0);
    const totalExercises = rankingItems.reduce((sum, item) => sum + item.exercises, 0);
    const avgScore = rankingItems.length > 0 ? Math.round(totalScore / rankingItems.length) : 0;
    
    const details = [
        { label: '총 획득 점수', value: `${totalScore}점` },
        { label: '총 운동 횟수', value: `${totalExercises}회` },
        { label: '평균 점수', value: `${avgScore}점` },
        { label: '참여 멤버', value: `${rankingItems.length}명` }
    ];
    
    details.forEach(detail => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';
        detailItem.innerHTML = `
            <div class="detail-label">${detail.label}</div>
            <div class="detail-value">${detail.value}</div>
        `;
        container.appendChild(detailItem);
    });
}

// 월별 랭킹 네비게이션
function navigateMonthlyRanking(direction) {
    if (direction === 'prev') {
        selectedMonthDate.setMonth(selectedMonthDate.getMonth() - 1);
    } else if (direction === 'next') {
        selectedMonthDate.setMonth(selectedMonthDate.getMonth() + 1);
    }
    
    updateMonthlyRankingData();
}

// 프로필 이미지 소스 가져오기
function getProfileImageSrc(profileName) {
    const imageMap = {
        '아빠': 'dad.png',
        '엄마': 'mom.png',
        '주환': 'juhwan.png',
        '태환': 'taehwan.png'
    };
    return imageMap[profileName] || 'icon.png';
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

// Firebase에 데이터 저장 (개선된 버전)
async function saveDataToFirebase(data) {
    if (!isFirebaseAvailable) return false;
    
    try {
        // 타임스탬프 추가로 동시 업데이트 감지
        const dataWithTimestamp = {
            ...data,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: navigator.userAgent.substring(0, 50) // 간단한 클라이언트 식별자
        };
        
        // 전체 문서 교체 (merge: false)로 데이터 일관성 보장
        await db.collection('families').doc(FAMILY_CODE).set(dataWithTimestamp);
        console.log("🔥 Firebase에 데이터 저장 성공");
        return true;
    } catch (error) {
        console.warn("⚠️ Firebase 데이터 저장 실패:", error);
        return false;
    }
}

// 데이터 로드 (Firebase 우선, 로컬 백업) - 개선된 버전
async function loadData() {
    console.log('📊 데이터 로드 시작...');
    
    // 강제 동기화 플래그 확인
    const forceSyncFlag = localStorage.getItem('force_firebase_sync');
    if (forceSyncFlag === 'true') {
        console.log('🔄 강제 Firebase 동기화 모드 활성화');
        localStorage.removeItem('force_firebase_sync');
    }
    
    // Firebase에서 먼저 시도
    if (isFirebaseAvailable) {
        console.log('🔥 Firebase에서 데이터 로드 시도...');
        const firebaseData = await loadDataFromFirebase();
        if (firebaseData) {
            console.log('✅ Firebase 데이터 로드 성공');
            
            // 로컬 데이터와 병합 (강제 동기화가 아닌 경우)
            if (forceSyncFlag !== 'true') {
                const localDataStr = localStorage.getItem(STORAGE_KEY);
                if (localDataStr) {
                    console.log('🔄 Firebase와 로컬 데이터 병합 중...');
                    const mergedData = await mergeDataSafely(firebaseData);
                    return mergedData;
                }
            }
            
            return firebaseData;
        } else {
            console.log('⚠️ Firebase 데이터 로드 실패');
        }
    } else {
        console.log('📱 Firebase 연결 불가 - 로컬 모드');
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

// 안전한 데이터 병합 (충돌 해결) - 개선된 버전
async function mergeDataSafely(firebaseData) {
    try {
        console.log('🔄 데이터 병합 시작...');
        
        // 로컬 데이터 가져오기
        const localDataStr = localStorage.getItem(STORAGE_KEY);
        const localData = localDataStr ? JSON.parse(localDataStr) : null;
        
        // Firebase 데이터가 없으면 로컬 데이터 반환
        if (!firebaseData) {
            console.log('Firebase 데이터가 없음 - 로컬 데이터 사용');
            return localData || getDefaultData();
        }
        
        // 로컬 데이터가 없으면 Firebase 데이터 반환
        if (!localData) {
            console.log('로컬 데이터가 없음 - Firebase 데이터 사용');
            return firebaseData;
        }
        
        console.log('로컬과 Firebase 데이터 병합 중...');
        
        // 타임스탬프 비교로 더 최신 데이터 우선 사용
        const firebaseTimestamp = firebaseData.lastUpdated?.toDate?.() || new Date(0);
        const localTimestamp = localData.lastUpdated ? new Date(localData.lastUpdated) : new Date(0);
        
        console.log('Firebase 타임스탬프:', firebaseTimestamp);
        console.log('로컬 타임스탬프:', localTimestamp);
        
        // 프로필별로 병합
        const mergedProfiles = {};
        const allProfiles = ['아빠', '엄마', '주환', '태환'];
        
        for (const profileName of allProfiles) {
            const localProfile = localData.profiles?.[profileName] || { exercisePlans: [], monthlyData: {} };
            const firebaseProfile = firebaseData.profiles?.[profileName] || { exercisePlans: [], monthlyData: {} };
            
            // 운동 계획 병합 (ID 기준으로 중복 제거하되 completed_dates 병합)
            const allPlans = [...(localProfile.exercisePlans || []), ...(firebaseProfile.exercisePlans || [])];
            const planMap = new Map();
            
            // ID별로 계획들을 그룹화하고 completed_dates 병합
            for (const plan of allPlans) {
                const planId = plan.id;
                if (!planMap.has(planId)) {
                    planMap.set(planId, { ...plan, completed_dates: [...(plan.completed_dates || [])] });
                } else {
                    const existingPlan = planMap.get(planId);
                    // completed_dates 병합 (중복 제거)
                    const allCompletedDates = [
                        ...(existingPlan.completed_dates || []),
                        ...(plan.completed_dates || [])
                    ];
                    const uniqueCompletedDates = [...new Set(allCompletedDates)];
                    
                    // 더 최신 정보로 업데이트 (created_date 기준)
                    const existingDate = new Date(existingPlan.created_date || 0);
                    const currentDate = new Date(plan.created_date || 0);
                    
                    if (currentDate >= existingDate) {
                        planMap.set(planId, {
                            ...plan,
                            completed_dates: uniqueCompletedDates
                        });
                    } else {
                        existingPlan.completed_dates = uniqueCompletedDates;
                    }
                }
            }
            
            const uniquePlans = Array.from(planMap.values())
                .sort((a, b) => (b.id || 0) - (a.id || 0));
            
            // 월별 데이터 병합 (개선된 버전)
            const mergedMonthlyData = { ...localProfile.monthlyData };
            if (firebaseProfile.monthlyData) {
                for (const [month, monthData] of Object.entries(firebaseProfile.monthlyData)) {
                    if (!mergedMonthlyData[month]) {
                        mergedMonthlyData[month] = { ...monthData };
                    } else {
                        // 월별 계획도 동일한 방식으로 병합
                        const monthPlans = [...(mergedMonthlyData[month].exercisePlans || []), ...(monthData.exercisePlans || [])];
                        const monthPlanMap = new Map();
                        
                        for (const plan of monthPlans) {
                            const planId = plan.id;
                            if (!monthPlanMap.has(planId)) {
                                monthPlanMap.set(planId, { ...plan, completed_dates: [...(plan.completed_dates || [])] });
                            } else {
                                const existingPlan = monthPlanMap.get(planId);
                                const allCompletedDates = [
                                    ...(existingPlan.completed_dates || []),
                                    ...(plan.completed_dates || [])
                                ];
                                const uniqueCompletedDates = [...new Set(allCompletedDates)];
                                
                                const existingDate = new Date(existingPlan.created_date || 0);
                                const currentDate = new Date(plan.created_date || 0);
                                
                                if (currentDate >= existingDate) {
                                    monthPlanMap.set(planId, {
                                        ...plan,
                                        completed_dates: uniqueCompletedDates
                                    });
                                } else {
                                    existingPlan.completed_dates = uniqueCompletedDates;
                                }
                            }
                        }
                        
                        const uniqueMonthPlans = Array.from(monthPlanMap.values())
                            .sort((a, b) => (b.id || 0) - (a.id || 0));
                        
                        mergedMonthlyData[month] = {
                            ...monthData,
                            exercisePlans: uniqueMonthPlans
                        };
                    }
                }
            }
            
            mergedProfiles[profileName] = {
                exercisePlans: uniquePlans,
                monthlyData: mergedMonthlyData,
                score: Math.max(localProfile.score || 0, firebaseProfile.score || 0),
                completedCount: Math.max(localProfile.completedCount || 0, firebaseProfile.completedCount || 0)
            };
        }
        
        const mergedData = {
            defaultProfile: firebaseData.defaultProfile || localData.defaultProfile,
            profiles: mergedProfiles,
            lastUpdated: firebaseTimestamp > localTimestamp ? firebaseData.lastUpdated : localData.lastUpdated
        };
        
        console.log('✅ 데이터 병합 완료 - 총 프로필:', Object.keys(mergedProfiles).length);
        return mergedData;
        
    } catch (error) {
        console.error('❌ 데이터 병합 중 오류:', error);
        return firebaseData || localData || getDefaultData();
    }
}

// 기본 데이터 구조 반환
function getDefaultData() {
    return {
        defaultProfile: null,
        profiles: {
            '아빠': { exercisePlans: [], monthlyData: {}, score: 0, completedCount: 0 },
            '엄마': { exercisePlans: [], monthlyData: {}, score: 0, completedCount: 0 },
            '주환': { exercisePlans: [], monthlyData: {}, score: 0, completedCount: 0 },
            '태환': { exercisePlans: [], monthlyData: {}, score: 0, completedCount: 0 }
        }
    };
}

// 데이터 저장 (Firebase + 로컬 백업) - 개선된 버전
async function saveData(data) {
    try {
        console.log('💾 데이터 저장 시작...');
        
        // Firebase 업데이트 중임을 표시 (무한 루프 방지)
        isUpdatingFromFirebase = true;
        
        // 타임스탬프 추가
        const dataWithTimestamp = {
            ...data,
            lastUpdated: new Date().toISOString()
        };
        
        // 로컬에 백업 저장
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithTimestamp));
        console.log('✅ 로컬 저장 완료');
        
        // Firebase에도 저장 시도
        if (isFirebaseAvailable) {
            console.log('🔥 Firebase 저장 시도...');
            const success = await saveDataToFirebase(dataWithTimestamp);
            if (success) {
                console.log('✅ Firebase 저장 성공');
                showMessage('🔄 가족과 동기화 완료', true);
            } else {
                console.warn('⚠️ Firebase 저장 실패 - 로컬 저장만 완료됨');
                showMessage('📱 로컬 저장 완료 (동기화 재시도 중)', true);
                
                // 재시도 로직 추가
                setTimeout(async () => {
                    console.log('🔄 Firebase 저장 재시도...');
                    const retrySuccess = await saveDataToFirebase(dataWithTimestamp);
                    if (retrySuccess) {
                        console.log('✅ Firebase 저장 재시도 성공');
                        showMessage('🔄 지연 동기화 완료', true);
                    }
                }, 5000);
            }
        } else {
            console.log('📱 오프라인 모드 - 로컬 저장만 완료');
            showMessage('📱 오프라인 저장 완료', true);
        }
        
        // 동적 지연 후 플래그 해제 (Firebase 저장 상태에 따라)
        const delay = isFirebaseAvailable ? 2000 : 500;
        setTimeout(() => {
            isUpdatingFromFirebase = false;
            console.log('🏁 저장 플래그 해제됨');
        }, delay);
        
    } catch (error) {
        console.error('❌ 데이터 저장 중 오류:', error);
        isUpdatingFromFirebase = false;
        showMessage('❌ 저장 중 오류 발생', true);
        throw error;
    }
}

// 메시지 표시
function showMessage(message, isSmall = false) {
    // 간단한 토스트 메시지 구현
    const toast = document.createElement('div');
    
    if (isSmall) {
        // 작은 메시지 스타일 (투명 배경)
        toast.style.cssText = `
            position: fixed;
            top: 15px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.3);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            font-size: 0.85rem;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3);
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        `;
    } else {
        // 일반 메시지 스타일
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
    }
    
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
    
    // 작은 메시지는 더 짧게 표시
    const displayTime = isSmall ? 1500 : 3000;
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, displayTime);
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
            <h2 style="color: #4a5568; margin-bottom: 20px;">🔥 우리가족 운동관리 앱 🔥</h2>
            <p style="margin-bottom: 15px; line-height: 1.6;">🏃‍♂️ 가족의 운동을 관리할 수 있어요 </p>
            <p style="margin-bottom: 15px; line-height: 1.6;">📊 운동을 통해 점수를 획득하고 랭킹을 확인하세요</p>
            
            <h3 style="color: #4a5568; margin: 20px 0 10px;">💡 어떻게 사용해요? </h3>
            <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 8px;"><strong>1.</strong> 프로필을 선택하세요</div>
                <div style="margin-bottom: 8px;"><strong>2.</strong> 운동 계획을 추가하세요</div>
                <div style="margin-bottom: 8px;"><strong>3.</strong> <strong>💪 오늘 완료하기</strong> 버튼으로 운동 완료!</div>
                <div><strong>4.</strong> 점수를 획득하고 가족 랭킹을 확인하세요</div>
            </div>
            
            <h3 style="color: #2196f3; margin: 20px 0 10px;">🏆 점수는 어떻게 되요? </h3>
            <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 12px;"><strong>🎯 운동 완료 점수:</strong></div>
                <div style="margin-left: 16px; margin-bottom: 8px;">🏃 러닝 15점 | 🏃‍♀️ 러닝머신 15점</div>
                <div style="margin-left: 16px; margin-bottom: 8px;">🏊 수영 20점 | 🏋️ 기구운동 18점</div>
                <div style="margin-left: 16px; margin-bottom: 8px;">🚴 자전거 12점 | 🧘 요가 10점</div>
                <div style="margin-left: 16px; margin-bottom: 8px;">⚾ 야구 10점 | ⚽ 축구 10점 | 🏀 농구 10점</div>
                <div style="margin-left: 16px; margin-bottom: 12px;">🚶 걷기 8점 | 🏃‍♂️ 기타 5점</div>
                <div style="margin-bottom: 8px;"><strong>✅ 계획만 등록해도 </strong> 1점을 받아요 </div>
                <div><strong>📊 총점:</strong> 운동 완료 점수 + 계획 보너스 점수</div>
            </div>
            
            <h3 style="color: #ff9800; margin: 20px 0 10px;">🏰 계급은 어떻게 되요?</h3>
            <div style="text-align: left; background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 8px;"><strong>✨ 신 </strong> 400점 이상</div>
                <div style="margin-bottom: 8px;"><strong>👑 왕 </strong> 300-399점</div>
                <div style="margin-bottom: 8px;"><strong>🛡️ 백작 </strong> 200-299점</div>
                <div style="margin-bottom: 8px;"><strong>🏇 기사 </strong> 120-199점</div>
                <div style="margin-bottom: 8px;"><strong>🌾 농민 </strong> 50-119점</div>
                <div><strong>⛓️ 노예 </strong> 0-49점 ㅜㅜㅜ</div>
            </div>
            
            <h3 style="color: #4caf50; margin: 20px 0 10px;">🔥 이런것도 되요! </h3>
            <div style="text-align: left; background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="margin-bottom: 8px;">✅ <strong>실시간 동기화 </strong> 운동 완료시 즉시 공유</div>
                <div style="margin-bottom: 8px;">✅ <strong>클라우드 백업 </strong> 데이터 분실 걱정 없음</div>
                <div style="margin-bottom: 8px;">✅ <strong>오프라인 지원 </strong> 인터넷 없어도 기록 가능</div>
                <div style="margin-bottom: 8px;">🌤️ <strong>실시간 날씨 정보 </strong> 현재 위치 기반 날씨 표시</div>
                <div>🤖 <strong>AI 동기부여 코치 </strong> 운동 기록과 날씨를 분석한 맞춤 조언</div>
            </div>
            
            <p style="color: #666; font-style: italic; margin-bottom: 20px;">Made with ❤️ for Family Fitness<br/>

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

// ================================
// 날씨 기능
// ================================

// OpenWeatherMap API 키 (무료 계정용)
// 🔑 무료 API 키 설정 방법:
// 1. https://openweathermap.org/api 에서 무료 계정 생성 (신용카드 불필요)
// 2. API Keys 메뉴에서 키 복사
// 3. 아래 'YOUR_API_KEY'를 실제 키로 교체
// 
// 💰 무료 플랜 혜택:
// - 월 1,000회 호출 (하루 33회, 가족 앱 사용량 충분)
// - 실시간 날씨 + 지역명 조회 모두 포함
// - ✨ "화성시, 경기도" 수준까지 정확한 지역명 가능!
const WEATHER_API_KEY = 'b5265909342f0823ecdf710393a1dd04'; // OpenWeatherMap API 키 적용됨

// 날씨 아이콘 매핑
const weatherIcons = {
    '01d': '☀️', '01n': '🌙',  // clear sky
    '02d': '⛅', '02n': '☁️',  // few clouds
    '03d': '☁️', '03n': '☁️',  // scattered clouds
    '04d': '☁️', '04n': '☁️',  // broken clouds
    '09d': '🌧️', '09n': '🌧️', // shower rain
    '10d': '🌦️', '10n': '🌧️', // rain
    '11d': '⛈️', '11n': '⛈️',  // thunderstorm
    '13d': '❄️', '13n': '❄️',  // snow
    '50d': '🌫️', '50n': '🌫️'  // mist
};

// 날씨 설명 한국어 매핑
const weatherDescriptions = {
    'clear sky': '맑음',
    'few clouds': '구름 조금',
    'scattered clouds': '구름 많음',
    'broken clouds': '흐림',
    'shower rain': '소나기',
    'rain': '비',
    'thunderstorm': '천둥번개',
    'snow': '눈',
    'mist': '안개',
    'overcast clouds': '흐림',
    'light rain': '가벼운 비',
    'moderate rain': '보통 비',
    'heavy intensity rain': '폭우',
    'very heavy rain': '매우 강한 비',
    'extreme rain': '극심한 비'
};

// 현재 위치 가져오기
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('GPS를 지원하지 않는 브라우저입니다.'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5분간 캐시된 위치 사용
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                let errorMessage = '';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '위치 정보 접근이 거부되었습니다.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '위치 정보를 사용할 수 없습니다.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '위치 정보 요청 시간이 초과되었습니다.';
                        break;
                    default:
                        errorMessage = '위치 정보를 가져오는 중 오류가 발생했습니다.';
                        break;
                }
                reject(new Error(errorMessage));
            },
            options
        );
    });
}

// 날씨 정보 가져오기 (실제 API 사용 시)
async function fetchWeatherData(lat, lon) {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`
        );
        
        if (!response.ok) {
            throw new Error('날씨 정보를 가져올 수 없습니다.');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('날씨 API 오류:', error);
        throw error;
    }
}

// 2시간 예보 가져오기 (실제 API 사용 시)
async function fetchHourlyForecast(lat, lon) {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=kr&cnt=3`
        );
        
        if (!response.ok) {
            throw new Error('예보 정보를 가져올 수 없습니다.');
        }
        
        const data = await response.json();
        return data.list.slice(1, 3); // 1시간, 2시간 후 데이터만
    } catch (error) {
        console.error('예보 API 오류:', error);
        throw error;
    }
}

// 모의 날씨 데이터 (API 키가 없을 때 사용) - 위치 기반 개선
function getMockWeatherData(locationName = null) {
    const now = new Date();
    const hour = now.getHours();
    
    // 현재 위치명 설정 (위치 정보가 있으면 사용, 없으면 기본값)
    const displayName = locationName || '현재 위치 (데모)';
    
    // 시간대별 날씨 시뮬레이션
    let mockData = {
        main: { temp: 20, feels_like: 22, humidity: 65 },
        weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
        name: displayName,
        sys: { country: 'KR' },
        wind: { speed: 2.5 }
    };
    
    // 시간에 따른 온도와 날씨 조정
    if (hour >= 6 && hour < 12) {
        // 아침
        mockData.main.temp = Math.floor(Math.random() * 5) + 15; // 15-19도
        mockData.weather[0].icon = hour < 9 ? '01d' : '02d';
        mockData.weather[0].description = hour < 9 ? 'clear sky' : 'few clouds';
    } else if (hour >= 12 && hour < 18) {
        // 낮
        mockData.main.temp = Math.floor(Math.random() * 8) + 20; // 20-27도
        mockData.weather[0].icon = '01d';
        mockData.weather[0].description = 'clear sky';
    } else if (hour >= 18 && hour < 21) {
        // 저녁
        mockData.main.temp = Math.floor(Math.random() * 6) + 18; // 18-23도
        mockData.weather[0].icon = '02d';
        mockData.weather[0].description = 'few clouds';
    } else {
        // 밤
        mockData.main.temp = Math.floor(Math.random() * 5) + 12; // 12-16도
        mockData.weather[0].icon = '01n';
        mockData.weather[0].description = 'clear sky';
    }
    
    return Promise.resolve(mockData);
}

// 모의 2시간 예보 데이터
function getMockHourlyForecast() {
    const now = new Date();
    const currentTemp = 20; // 기본 온도
    
    const forecast = [];
    for (let i = 1; i <= 2; i++) {
        const futureHour = new Date(now.getTime() + i * 60 * 60 * 1000);
        const hour = futureHour.getHours();
        
        let temp = currentTemp + Math.floor(Math.random() * 6) - 3; // ±3도 변동
        let icon = '01d';
        let description = 'clear sky';
        let rainProbability = Math.floor(Math.random() * 40); // 0-40% 기본 확률
        
        // 시간에 따른 날씨 조정
        if (hour >= 6 && hour < 18) {
            icon = ['01d', '02d', '03d'][Math.floor(Math.random() * 3)];
        } else {
            icon = ['01n', '02n', '03n'][Math.floor(Math.random() * 3)];
        }
        
        // 30% 확률로 비 오는 날씨
        if (Math.random() < 0.3) {
            icon = hour >= 6 && hour < 18 ? '10d' : '10n';
            description = 'rain';
            rainProbability = Math.floor(Math.random() * 40) + 60; // 60-100% 확률
        }
        
        // 구름 많은 날씨면 비올 확률 증가
        if (icon.includes('03') || icon.includes('04')) {
            rainProbability = Math.floor(Math.random() * 30) + 20; // 20-50% 확률
        }
        
        forecast.push({
            main: { temp },
            weather: [{ icon, description }],
            dt_txt: futureHour.toISOString(),
            pop: rainProbability / 100 // API 형식에 맞게 0-1 범위로 변환
        });
    }
    
    return Promise.resolve(forecast);
}

// 현재 시간 포맷팅
function getCurrentTimeString() {
    const now = new Date();
    const options = { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    };
    return now.toLocaleTimeString('ko-KR', options);
}

// 2시간 예보 UI 업데이트
function updateForecastUI(forecastData) {
    const forecastItems = document.getElementById('forecast-items');
    if (!forecastItems || !forecastData) return;

    const items = forecastItems.querySelectorAll('.forecast-item');
    
    forecastData.forEach((forecast, index) => {
        if (index < items.length) {
            const item = items[index];
            const temp = Math.round(forecast.main.temp);
            const iconCode = forecast.weather[0].icon;
            const rainProbability = forecast.pop ? Math.round(forecast.pop * 100) : 0;
            
            const timeElement = item.querySelector('.forecast-time');
            const iconElement = item.querySelector('.forecast-icon');
            const tempElement = item.querySelector('.forecast-temp');
            const rainElement = item.querySelector('.forecast-rain');
            
            if (timeElement) timeElement.textContent = `${index + 1}시간 후`;
            if (iconElement) iconElement.textContent = weatherIcons[iconCode] || '🌤️';
            if (tempElement) tempElement.textContent = `${temp}°C`;
            if (rainElement) rainElement.textContent = `🌧️ ${rainProbability}%`;
        }
    });
}

// 날씨 정보 업데이트
async function updateWeatherInfo() {
    const weatherIcon = document.getElementById('weather-icon');
    const weatherTemp = document.getElementById('weather-temp');
    const weatherDesc = document.getElementById('weather-desc');
    const weatherLocation = document.getElementById('weather-location');
    const refreshBtn = document.getElementById('weather-refresh');
    
    if (!weatherIcon || !weatherTemp || !weatherDesc || !weatherLocation) {
        console.warn('날씨 UI 요소를 찾을 수 없습니다.');
        return;
    }

    try {
        // 로딩 상태 표시
        refreshBtn?.classList.add('loading');
        weatherTemp.textContent = '--°C';
        weatherDesc.textContent = '날씨 정보 로딩중...';
        weatherLocation.textContent = '📍 위치 확인중...';
        
        let weatherData;
        let forecastData;
        let locationName = '';
        let location = null;
        
        try {
            // 실제 위치 가져오기 시도
            location = await getCurrentLocation();
            locationName = `📍 ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
            console.log(`📍 현재 위치 확인됨: ${locationName}`);
            
            // API 키가 설정되어 있다면 실제 날씨 데이터 사용
            if (WEATHER_API_KEY && WEATHER_API_KEY !== 'YOUR_API_KEY') {
                console.log('🌤️ 실제 날씨 API로 데이터 가져오는 중...');
                weatherData = await fetchWeatherData(location.latitude, location.longitude);
                forecastData = await fetchHourlyForecast(location.latitude, location.longitude);
                locationName = `📍 ${weatherData.name}`;
                console.log(`✅ 실제 날씨 데이터: ${weatherData.name}, ${Math.round(weatherData.main.temp)}°C`);
            } else {
                // API 키가 없다면 현재 위치 기반 모의 데이터 사용
                console.log('📱 현재 위치 기반 Mock 데이터 생성 중...');
                const estimatedLocation = await getLocationNameFromCoords(location.latitude, location.longitude);
                weatherData = await getMockWeatherData(estimatedLocation);
                forecastData = await getMockHourlyForecast();
                locationName = `📍 ${estimatedLocation} (데모)`;
                console.log(`📱 Mock 데이터 생성: ${estimatedLocation}`);
            }
        } catch (locationError) {
            console.warn('위치 정보 가져오기 실패:', locationError.message);
            // 위치 접근 실패 시 기본 위치로 모의 데이터 사용
            weatherData = await getMockWeatherData('현재 위치');
            forecastData = await getMockHourlyForecast();
            locationName = `📍 현재 위치 (위치접근불가)`;
        }
        
        // 현재 날씨 UI 업데이트
        const temp = Math.round(weatherData.main.temp);
        const iconCode = weatherData.weather[0].icon;
        const description = weatherData.weather[0].description;
        
        weatherIcon.textContent = weatherIcons[iconCode] || '🌤️';
        weatherTemp.textContent = `${temp}°C`;
        weatherDesc.textContent = weatherDescriptions[description] || description;
        weatherLocation.textContent = `${locationName} • ${getCurrentTimeString()}`;
        
        // 2시간 예보 UI 업데이트
        updateForecastUI(forecastData);
        
        console.log('✅ 날씨 정보 업데이트 완료:', {
            temp,
            description,
            location: locationName,
            forecast: forecastData?.length || 0
        });
        
    } catch (error) {
        console.error('❌ 날씨 정보 업데이트 실패:', error);
        
        // 오류 시 기본 표시
        weatherIcon.textContent = '🌤️';
        weatherTemp.textContent = '--°C';
        weatherDesc.textContent = '날씨 정보 오류';
        weatherLocation.textContent = `📍 정보 없음 • ${getCurrentTimeString()}`;
        
        // 예보도 기본 표시
        const forecastItems = document.getElementById('forecast-items');
        if (forecastItems) {
            const items = forecastItems.querySelectorAll('.forecast-item');
            items.forEach((item, index) => {
                const timeElement = item.querySelector('.forecast-time');
                const iconElement = item.querySelector('.forecast-icon');
                const tempElement = item.querySelector('.forecast-temp');
                const rainElement = item.querySelector('.forecast-rain');
                
                if (timeElement) timeElement.textContent = `${index + 1}시간 후`;
                if (iconElement) iconElement.textContent = '🌤️';
                if (tempElement) tempElement.textContent = '--°C';
                if (rainElement) rainElement.textContent = '🌧️ --%';
            });
        }
    } finally {
        // 로딩 상태 해제
        refreshBtn?.classList.remove('loading');
    }
}

// 날씨 새로고침 버튼 이벤트
function initWeatherRefreshButton() {
    const refreshBtn = document.getElementById('weather-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            updateWeatherInfo();
        });
    }
}

// 자동 날씨 업데이트 (10분마다)
let weatherUpdateInterval;

function startWeatherAutoUpdate() {
    // 초기 로드
    updateWeatherInfo();
    
    // 10분마다 자동 업데이트
    if (weatherUpdateInterval) {
        clearInterval(weatherUpdateInterval);
    }
    
    weatherUpdateInterval = setInterval(() => {
        updateWeatherInfo();
        console.log('🔄 날씨 정보 자동 업데이트');
    }, 10 * 60 * 1000); // 10분
}

// 페이지 비시블리티 변경 시 날씨 업데이트
function initWeatherVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // 페이지가 다시 보이게 되면 날씨 정보 업데이트
            updateWeatherInfo();
        }
    });
}

// 날씨 기능 초기화
function initWeatherFeature() {
    console.log('🌤️ 날씨 기능 초기화 시작');
    
    // 새로고침 버튼 이벤트 등록
    initWeatherRefreshButton();
    
    // 페이지 가시성 변경 이벤트 등록
    initWeatherVisibilityHandler();
    
    // 자동 업데이트 시작
    startWeatherAutoUpdate();
    
    console.log('✅ 날씨 기능 초기화 완료');
}

// ================================
// AI 동기부여 메시지 기능
// ================================

// Hugging Face API 설정 (무료 Inference API)
// 텍스트 생성에 적합한 모델 사용 (GPT-2 계열)
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/gpt2';
const HUGGINGFACE_API_KEY = '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'; // 실제 사용 시 본인의 API 키로 교체

// 대안 무료 AI API들 (Hugging Face 실패 시 사용)
const ALTERNATIVE_AI_APIS = [
    {
        name: 'GPT4All 로컬',
        url: 'http://localhost:4891/v1/chat/completions',
        enabled: false // 로컬 설치 필요
    },
    {
        name: 'Ollama 로컬', 
        url: 'http://localhost:11434/api/generate',
        enabled: false // 로컬 설치 필요
    }
];

// 운동 데이터 분석 함수 - 수정된 버전
async function analyzeExerciseData(profileName) {
    if (!profileName) return null;
    
    try {
        // 실제 저장된 데이터 로드
        const data = await loadData();
        if (!data || !data.profiles) {
            console.log('❌ 데이터가 없습니다.');
            return null;
        }
        
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        // 현재 프로필의 운동 기록
        const profileData = data.profiles[profileName];
        if (!profileData || !profileData.exercisePlans) {
            console.log(`❌ ${profileName} 프로필의 운동 계획이 없습니다.`);
            return null;
        }
        
        const userPlans = profileData.exercisePlans || [];
        console.log(`📊 ${profileName} 총 운동 계획 수:`, userPlans.length);
        
        // 이번 주 운동 완료 횟수 계산
        let thisWeekExercises = 0;
        userPlans.forEach(plan => {
            const completedDates = plan.completed_dates || [];
            const thisWeekCompletions = completedDates.filter(dateStr => {
                const date = new Date(dateStr);
                return date >= oneWeekAgo && date <= now;
            });
            thisWeekExercises += thisWeekCompletions.length;
        });
        
        // 지난 주 운동 완료 횟수 계산
        let lastWeekExercises = 0;
        userPlans.forEach(plan => {
            const completedDates = plan.completed_dates || [];
            const lastWeekCompletions = completedDates.filter(dateStr => {
                const date = new Date(dateStr);
                return date >= twoWeeksAgo && date < oneWeekAgo;
            });
            lastWeekExercises += lastWeekCompletions.length;
        });
        
        // 이번 달 운동 완료 횟수 계산
        let thisMonthExercises = 0;
        userPlans.forEach(plan => {
            const completedDates = plan.completed_dates || [];
            const thisMonthCompletions = completedDates.filter(dateStr => {
                const date = new Date(dateStr);
                return date >= oneMonthAgo && date <= now;
            });
            thisMonthExercises += thisMonthCompletions.length;
        });
        
        // 가족 전체 평균 계산
        const allProfiles = ['아빠', '엄마', '주환', '태환'];
        const familyThisWeek = allProfiles.map(profile => {
            const familyProfileData = data.profiles[profile];
            if (!familyProfileData || !familyProfileData.exercisePlans) return 0;
            
            let profileWeekExercises = 0;
            familyProfileData.exercisePlans.forEach(plan => {
                const completedDates = plan.completed_dates || [];
                const weekCompletions = completedDates.filter(dateStr => {
                    const date = new Date(dateStr);
                    return date >= oneWeekAgo && date <= now;
                });
                profileWeekExercises += weekCompletions.length;
            });
            return profileWeekExercises;
        });
        
        const familyAverage = familyThisWeek.reduce((sum, count) => sum + count, 0) / allProfiles.length;
        
        const result = {
            profileName,
            thisWeek: thisWeekExercises,
            lastWeek: lastWeekExercises,
            thisMonth: thisMonthExercises,
            familyAverage: Math.round(familyAverage * 10) / 10,
            trend: thisWeekExercises - lastWeekExercises,
            isAboveAverage: thisWeekExercises > familyAverage
        };
        
        console.log(`📊 ${profileName} 운동 분석 결과:`, result);
        return result;
        
    } catch (error) {
        console.error('❌ 운동 데이터 분석 중 오류:', error);
        return null;
    }
}

// AI 프롬프트 생성
function generateMotivationPrompt(data, weatherData) {
    if (!data) return '';
    
    const { profileName, thisWeek, lastWeek, thisMonth, familyAverage, trend, isAboveAverage } = data;
    
    let situationContext = '';
    if (trend > 0) {
        situationContext = `${profileName}는 지난주(${lastWeek}회)보다 이번주(${thisWeek}회) 운동을 더 많이 했습니다.`;
    } else if (trend < 0) {
        situationContext = `${profileName}는 지난주(${lastWeek}회)보다 이번주(${thisWeek}회) 운동이 줄었습니다.`;
    } else {
        situationContext = `${profileName}는 지난주와 이번주 운동 횟수가 같습니다(${thisWeek}회).`;
    }
    
    const familyContext = isAboveAverage 
        ? `가족 평균(${familyAverage}회)보다 많이 운동하고 있습니다.`
        : `가족 평균(${familyAverage}회)보다 적게 운동하고 있습니다.`;
    
    // 날씨 상황 추가
    let weatherContext = '';
    if (weatherData) {
        const { temperature, condition, description, humidity, feelsLike } = weatherData;
        
        // 날씨별 운동 조언
        if (condition === 'Rain' || condition === 'Drizzle') {
            weatherContext = `오늘은 비가 와서(${description}) 실내 운동이 좋겠어요.`;
        } else if (condition === 'Snow') {
            weatherContext = `오늘은 눈이 와서(${description}) 실내에서 운동하시길 추천해요.`;
        } else if (temperature >= 30) {
            weatherContext = `오늘은 더워서(${temperature}°C, 체감 ${feelsLike}°C) 시원한 시간대나 실내 운동이 좋겠어요.`;
        } else if (temperature <= 5) {
            weatherContext = `오늘은 추워서(${temperature}°C, 체감 ${feelsLike}°C) 충분한 준비운동 후 운동하세요.`;
        } else if (condition === 'Clear') {
            weatherContext = `오늘은 날씨가 맑아서(${temperature}°C) 야외 운동하기 좋은 날이에요.`;
        } else {
            weatherContext = `현재 날씨는 ${description}(${temperature}°C)입니다.`;
        }
    }
    
    // AI가 더 자연스럽게 생성할 수 있도록 간단하고 명확한 프롬프트 구성
    const contextPrompt = `${profileName}의 운동 상황: ${situationContext} ${familyContext} 이번달 ${thisMonth}회 운동했습니다.`;
    const weatherPrompt = weatherContext ? ` 날씨 상황: ${weatherContext}` : '';
    const requestPrompt = `\n\n위 정보를 바탕으로 ${profileName}에게 따뜻하고 격려하는 운동 동기부여 메시지를 한국어로 40자 이내로 작성해주세요. 친근하고 응원하는 톤으로 말해주세요:`;
    
    return contextPrompt + weatherPrompt + requestPrompt;
}

// 실제 AI 메시지 생성 (Hugging Face API 우선) - 개선된 버전
async function callHuggingFaceAPI(prompt) {
    // 실제 AI API 우선 시도
    if (HUGGINGFACE_API_KEY && HUGGINGFACE_API_KEY !== 'hf_YOUR_API_KEY') {
        console.log('🤖 실제 AI API 호출 중...');
        
        try {
            const response = await fetch(HUGGINGFACE_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 80,
                        temperature: 0.7,
                        do_sample: true,
                        top_p: 0.9,
                        repetition_penalty: 1.1
                    }
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                let aiMessage = result[0]?.generated_text || '';
                
                console.log('🤖 원본 AI 응답:', aiMessage);
                
                // 프롬프트 부분 제거하고 새로 생성된 부분만 추출
                if (aiMessage.includes(prompt)) {
                    aiMessage = aiMessage.replace(prompt, '').trim();
                }
                
                // 첫 번째 완전한 문장만 추출
                let sentences = aiMessage.split(/[.!?]\s*/);
                if (sentences.length > 0 && sentences[0].trim()) {
                    aiMessage = sentences[0].trim();
                    
                    // 마침표나 느낌표가 없으면 추가
                    if (!aiMessage.match(/[.!?]$/)) {
                        aiMessage += '!';
                    }
                }
                
                // 50자 이내로 조정
                if (aiMessage.length > 50) {
                    aiMessage = aiMessage.substring(0, 47) + '...';
                }
                
                // 최소 길이 체크 및 한국어 포함 여부 확인
                const hasKorean = /[가-힣]/.test(aiMessage);
                if (aiMessage && aiMessage.length > 5 && (hasKorean || aiMessage.length > 10)) {
                    console.log('✅ 실제 AI API 메시지 생성 성공:', aiMessage);
                    return { message: aiMessage, isRealAI: true };
                } else {
                    throw new Error('AI 응답이 부적절하거나 너무 짧음');
                }
            } else {
                const errorText = await response.text();
                console.log('🚫 AI API 오류 상세:', errorText);
                throw new Error(`AI API 응답 오류: ${response.status}`);
            }
        } catch (error) {
            console.log('❌ 실제 AI API 호출 실패, 메시지 조합 모드로 전환:', error.message);
            // AI 실패시 백업으로 조합 방식 사용
            const mockMessage = generateMockMotivationMessage(prompt);
            return { message: mockMessage, isRealAI: false };
        }
    } else {
        console.log('⚠️ AI API 키가 설정되지 않음 - 스마트 메시지 조합 모드 사용');
        // API 키가 없으면 백업으로 조합 방식 사용
        const mockMessage = generateMockMotivationMessage(prompt);
        return { message: mockMessage, isRealAI: false };
    }
}

// 동적 동기부여 메시지 생성 (AI처럼 자동 생성)
function generateMockMotivationMessage(prompt) {
    // 운동 데이터에서 정보 추출
    const data = extractDataFromPrompt(prompt);
    
    // 메시지 템플릿 구성 요소들
    const messageComponents = generateMessageComponents(data);
    
    // 동적으로 메시지 조합
    return assembleMotivationMessage(messageComponents, data);
}

// 프롬프트에서 데이터 추출 (운동 + 날씨)
function extractDataFromPrompt(prompt) {
    const data = {
        name: '회원',
        thisWeek: 0,
        lastWeek: 0,
        thisMonth: 0,
        familyAverage: 0,
        trend: 'same', // increase, decrease, same
        performance: 'average', // above, below, average
        weather: {
            condition: 'clear',
            temperature: 20,
            description: '맑음'
        }
    };
    
    // 이름 추출
    const nameMatch = prompt.match(/(아빠|엄마|주환|태환)/);
    if (nameMatch) data.name = nameMatch[1];
    
    // 숫자 추출
    const thisWeekMatch = prompt.match(/이번주\((\d+)회\)/);
    if (thisWeekMatch) data.thisWeek = parseInt(thisWeekMatch[1]);
    
    const lastWeekMatch = prompt.match(/지난주\((\d+)회\)/);
    if (lastWeekMatch) data.lastWeek = parseInt(lastWeekMatch[1]);
    
    const thisMonthMatch = prompt.match(/이번달 총 (\d+)회/);
    if (thisMonthMatch) data.thisMonth = parseInt(thisMonthMatch[1]);
    
    const avgMatch = prompt.match(/가족 평균\((\d+\.?\d*)회\)/);
    if (avgMatch) data.familyAverage = parseFloat(avgMatch[1]);
    
    // 트렌드 분석
    if (prompt.includes('더 많이')) data.trend = 'increase';
    else if (prompt.includes('줄었습니다')) data.trend = 'decrease';
    else data.trend = 'same';
    
    // 성과 분석
    if (prompt.includes('평균보다 많이')) data.performance = 'above';
    else if (prompt.includes('평균보다 적게')) data.performance = 'below';
    else data.performance = 'average';
    
    // 날씨 정보 추출
    const tempMatch = prompt.match(/(\d+)°C/);
    if (tempMatch) data.weather.temperature = parseInt(tempMatch[1]);
    
    if (prompt.includes('비가 와서') || prompt.includes('비')) {
        data.weather.condition = 'rain';
        data.weather.description = '비';
    } else if (prompt.includes('눈이 와서') || prompt.includes('눈')) {
        data.weather.condition = 'snow';
        data.weather.description = '눈';
    } else if (prompt.includes('더워서') || data.weather.temperature >= 30) {
        data.weather.condition = 'hot';
        data.weather.description = '더움';
    } else if (prompt.includes('추워서') || data.weather.temperature <= 5) {
        data.weather.condition = 'cold';
        data.weather.description = '추움';
    } else if (prompt.includes('맑아서') || prompt.includes('맑음')) {
        data.weather.condition = 'clear';
        data.weather.description = '맑음';
    } else if (prompt.includes('흐림') || prompt.includes('구름')) {
        data.weather.condition = 'cloudy';
        data.weather.description = '흐림';
    }
    
    return data;
}

// 메시지 구성 요소 생성 - 개선된 버전
function generateMessageComponents(data) {
    const components = {
        greeting: [],
        situation: [],
        encouragement: [],
        action: [],
        emoji: []
    };
    
    // 운동 데이터가 없거나 모든 값이 0인 경우 (운동 이력 없음)
    if (!data || (data.thisWeek === 0 && data.lastWeek === 0 && data.thisMonth === 0)) {
        return {
            greeting: ["안녕하세요!", "좋은 하루예요!", "반가워요!"],
            situation: ["아직 운동 기록이 없으시네요.", "새로운 시작이 기다리고 있어요!", "첫 걸음을 내딛어보세요!"],
            encouragement: ["시작이 반이에요!", "작은 변화부터 시작해봐요!", "오늘부터 함께 시작해요!", "천리길도 한 걸음부터예요!"],
            action: ["가벼운 산책부터 어떠세요?", "10분 스트레칭으로 시작해봐요!", "계단 오르기부터 도전해보세요!", "집 앞 한 바퀴 걸어보는 건 어떨까요?"],
            emoji: ["🌱", "✨", "💪", "🚀", "🌟", "👍", "💫", "🎯"]
        };
    }
    
    // 인사말 생성
    const greetings = [
        `${data.name}님,`, `안녕하세요 ${data.name}님!`, `${data.name}님 수고하세요!`,
        `운동하는 ${data.name}님,`, `건강한 ${data.name}님,`
    ];
    components.greeting = greetings;
    
    // 상황 분석 메시지
    if (data.trend === 'increase') {
        components.situation = [
            "운동량이 늘어나고 있어요!", "꾸준히 발전하고 계시네요!",
            "이번주 정말 열심히 하셨어요!", "운동 패턴이 좋아지고 있어요!",
            "성장하는 모습이 보여요!"
        ];
    } else if (data.trend === 'decrease') {
        components.situation = [
            "이번주는 조금 쉬어가셨네요.", "가끔은 휴식도 필요해요.",
            "천천히 다시 시작해봐요.", "무리하지 마세요.",
            "컨디션 조절도 중요해요."
        ];
    } else {
        components.situation = [
            "꾸준한 페이스를 유지하고 계시네요!", "안정적인 운동 패턴이에요!",
            "일정한 리듬을 유지하고 있어요!", "균형 잡힌 운동 스케줄이네요!"
        ];
    }
    
    // 격려 메시지
    if (data.performance === 'above') {
        components.encouragement = [
            "가족 중에서도 모범이에요!", "다른 가족들에게 좋은 영향을 주고 있어요!",
            "정말 대단한 성과네요!", "가족의 롤모델이 되고 있어요!",
            "훌륭한 노력이에요!"
        ];
    } else if (data.performance === 'below') {
        components.encouragement = [
            "충분히 잘하고 계세요!", "자신만의 속도로 가면 돼요!",
            "비교하지 말고 꾸준히 해봐요!", "작은 발걸음도 소중해요!",
            "천천히 해도 괜찮아요!"
        ];
    } else {
        components.encouragement = [
            "균형잡힌 운동을 하고 계시네요!", "적당한 강도로 잘 하고 있어요!",
            "건강한 운동 습관이에요!", "꾸준함이 가장 중요해요!"
        ];
    }
    
    // 행동 제안 (운동 횟수 + 날씨 고려)
    let weatherActions = [];
    
    // 날씨별 운동 추천
    if (data.weather.condition === 'rain') {
        weatherActions = ["실내 요가나 스트레칭 어때요?", "홈트레이닝으로 대체해보세요!", "실내에서 근력운동 해봐요!"];
    } else if (data.weather.condition === 'snow') {
        weatherActions = ["따뜻한 실내에서 운동해보세요!", "집에서 하는 요가가 좋겠어요!", "스트레칭으로 몸을 풀어보세요!"];
    } else if (data.weather.condition === 'hot') {
        weatherActions = ["시원한 새벽이나 저녁에 운동해보세요!", "에어컨 있는 곳에서 운동하세요!", "수분 보충 잊지 마세요!"];
    } else if (data.weather.condition === 'cold') {
        weatherActions = ["충분한 준비운동 후 시작하세요!", "따뜻하게 입고 운동해보세요!", "실내에서 몸을 먼저 풀어보세요!"];
    } else if (data.weather.condition === 'clear') {
        weatherActions = ["야외 산책이나 조깅 어때요?", "공원에서 운동하기 좋은 날이에요!", "맑은 하늘 아래 운동해보세요!"];
    } else {
        weatherActions = ["오늘도 건강한 운동해보세요!", "컨디션에 맞게 운동하세요!", "무리하지 말고 적당히 해보세요!"];
    }
    
    // 운동 횟수별 기본 추천
    let exerciseActions = [];
    if (data.thisWeek < 2) {
        exerciseActions = [
            "이번주에 한두 번 더 도전해봐요!", "가벼운 운동부터 시작해보세요!",
            "10분이라도 몸을 움직여봐요!", "스트레칭부터 시작해보는 건 어떨까요?"
        ];
    } else if (data.thisWeek >= 4) {
        exerciseActions = [
            "이 페이스를 계속 유지해봐요!", "정말 훌륭한 습관이에요!",
            "이 기세로 계속 화이팅!", "완벽한 운동 루틴이네요!"
        ];
    } else {
        exerciseActions = [
            "조금씩 더 늘려가봐요!", "꾸준히 계속해보세요!",
            "이 정도면 충분히 좋아요!", "건강한 변화가 느껴질 거예요!"
        ];
    }
    
    // 날씨 기반 추천과 일반 추천 합치기
    components.action = [...weatherActions, ...exerciseActions];
    
    // 이모지 (날씨 + 기본)
    let weatherEmojis = [];
    if (data.weather.condition === 'rain') {
        weatherEmojis = ["☔", "🌧️", "🏠", "🧘"];
    } else if (data.weather.condition === 'snow') {
        weatherEmojis = ["❄️", "⛄", "🏠", "🔥"];
    } else if (data.weather.condition === 'hot') {
        weatherEmojis = ["☀️", "🌞", "💧", "🧊"];
    } else if (data.weather.condition === 'cold') {
        weatherEmojis = ["🌨️", "🧤", "🔥", "☕"];
    } else if (data.weather.condition === 'clear') {
        weatherEmojis = ["🌞", "🌳", "🏃", "🚴"];
    } else {
        weatherEmojis = ["🌤️", "⛅"];
    }
    
    const baseEmojis = ["💪", "🔥", "✨", "🌟", "🏆", "👏", "🚀", "💖", "🌱", "⭐"];
    components.emoji = [...weatherEmojis, ...baseEmojis];
    
    return components;
}

// 메시지 조합
function assembleMotivationMessage(components, data) {
    const greeting = getRandomItem(components.greeting);
    const situation = getRandomItem(components.situation);
    const encouragement = getRandomItem(components.encouragement);
    const action = getRandomItem(components.action);
    const emoji = getRandomItem(components.emoji);
    
    // 다양한 메시지 패턴
    const patterns = [
        `${greeting} ${situation} ${encouragement} ${action} ${emoji}`,
        `${situation} ${encouragement} ${action} ${emoji}`,
        `${greeting} ${encouragement} ${action} ${emoji}`,
        `${situation} ${action} 함께 화이팅해요! ${emoji}`,
        `${encouragement} ${action} ${emoji}`
    ];
    
    const selectedPattern = getRandomItem(patterns);
    
    // 길이 조정 (50자 내외)
    if (selectedPattern.length > 55) {
        return `${encouragement} ${action} ${emoji}`;
    }
    
    return selectedPattern;
}

// 랜덤 아이템 선택
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// AI용 현재 날씨 데이터 가져오기 - 실제 위치 기반 개선
async function getCurrentWeatherForAI() {
    try {
        let position = null;
        let locationName = '현재 위치';
        
        // 먼저 현재 위치 가져오기 시도
        try {
            position = await getCurrentLocation();
            console.log(`📍 현재 위치 확인됨: ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`);
        } catch (locationError) {
            console.warn('위치 정보 가져오기 실패:', locationError.message);
            // 위치 접근 실패시에도 계속 진행 (Mock 데이터 사용)
        }
        
        // API 키가 있고 위치 정보가 있으면 실제 날씨 데이터 사용
        if (WEATHER_API_KEY && WEATHER_API_KEY !== 'YOUR_API_KEY' && position) {
            console.log('🌤️ 실제 날씨 API 호출 중...');
            const weatherData = await fetchWeatherData(position.latitude, position.longitude);
            
            console.log(`✅ 실제 날씨 데이터 로드 완료: ${weatherData.name}, ${Math.round(weatherData.main.temp)}°C`);
            
            return {
                temperature: Math.round(weatherData.main.temp),
                condition: weatherData.weather[0].main,
                description: weatherData.weather[0].description,
                humidity: weatherData.main.humidity,
                feelsLike: Math.round(weatherData.main.feels_like),
                location: weatherData.name
            };
        } else {
            // API 키가 없거나 위치 정보가 없으면 현재 위치 기반 Mock 데이터 사용
            let mockLocationName = locationName;
            
            if (position) {
                // 위치 정보가 있으면 좌표를 이용해 지역명 추정
                mockLocationName = await getLocationNameFromCoords(position.latitude, position.longitude);
            }
            
            console.log(`📱 Mock 날씨 데이터 사용: ${mockLocationName}`);
            const mockData = await getMockWeatherData(mockLocationName);
            
            return {
                temperature: Math.round(mockData.main.temp),
                condition: mockData.weather[0].main,
                description: mockData.weather[0].description,
                humidity: mockData.main.humidity,
                feelsLike: Math.round(mockData.main.feels_like),
                location: mockData.name
            };
        }
    } catch (error) {
        console.log('날씨 데이터 가져오기 실패, 기본값 사용:', error);
        // 에러 시 기본 날씨 데이터
        return {
            temperature: 20,
            condition: 'Clear',
            description: '맑음',
            humidity: 60,
            feelsLike: 22,
            location: '현재 위치'
        };
    }
}

// 좌표로부터 세부 지역명 가져오기 (Reverse Geocoding)
async function getLocationNameFromCoords(lat, lon) {
    try {
        // 🌍 OpenWeatherMap Reverse Geocoding API 사용 (API 키 필요)
        if (WEATHER_API_KEY && WEATHER_API_KEY !== 'YOUR_API_KEY') {
            console.log('🗺️ Reverse Geocoding API로 세부 지역명 조회 중...');
            
            const response = await fetch(
                `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${WEATHER_API_KEY}`
            );
            
            if (response.ok) {
                const locationData = await response.json();
                if (locationData && locationData.length > 0) {
                    const location = locationData[0];
                    console.log('🏘️ Reverse Geocoding 결과:', location);
                    
                    // 한국어 지역명 우선, 없으면 영어명 사용
                    const cityName = location.local_names?.ko || location.name;
                    const stateName = location.state;
                    
                    // "화성시, 경기도" 형태로 반환
                    const fullLocationName = stateName ? `${cityName}, ${stateName}` : cityName;
                    console.log(`✅ 세부 지역명 확인: ${fullLocationName}`);
                    
                    return fullLocationName;
                }
            } else {
                console.warn('⚠️ Reverse Geocoding API 호출 실패:', response.status);
            }
        } else {
            console.log('🔑 API 키가 설정되지 않음 - 대략적 지역 추정 사용');
        }
        
        // API가 없거나 실패시 좌표 기반으로 대한민국 지역 추정
        return estimateKoreanLocation(lat, lon);
        
    } catch (error) {
        console.warn('❌ 지역명 가져오기 실패:', error);
        return `위도 ${lat.toFixed(2)}, 경도 ${lon.toFixed(2)}`;
    }
}

// 좌표 기반 대한민국 지역 추정 (간단한 범위 체크)
function estimateKoreanLocation(lat, lon) {
    // 대한민국 주요 도시들의 대략적인 좌표 범위
    const regions = [
        { name: '서울특별시', lat: [37.4, 37.7], lon: [126.8, 127.2] },
        { name: '부산광역시', lat: [35.0, 35.3], lon: [128.9, 129.3] },
        { name: '대구광역시', lat: [35.7, 36.0], lon: [128.5, 128.8] },
        { name: '인천광역시', lat: [37.3, 37.6], lon: [126.4, 126.9] },
        { name: '광주광역시', lat: [35.1, 35.3], lon: [126.8, 127.0] },
        { name: '대전광역시', lat: [36.2, 36.5], lon: [127.3, 127.5] },
        { name: '울산광역시', lat: [35.4, 35.7], lon: [129.2, 129.4] },
        { name: '경기도', lat: [37.0, 38.0], lon: [126.5, 127.8] },
        { name: '강원도', lat: [37.0, 38.6], lon: [127.5, 129.4] },
        { name: '충청북도', lat: [36.2, 37.2], lon: [127.4, 128.8] },
        { name: '충청남도', lat: [35.8, 37.0], lon: [126.1, 127.8] },
        { name: '전라북도', lat: [35.6, 36.3], lon: [126.4, 127.8] },
        { name: '전라남도', lat: [34.2, 35.8], lon: [125.9, 127.6] },
        { name: '경상북도', lat: [35.4, 37.2], lon: [128.1, 130.0] },
        { name: '경상남도', lat: [34.6, 36.0], lon: [127.7, 129.2] },
        { name: '제주특별자치도', lat: [33.1, 33.6], lon: [126.1, 126.9] }
    ];
    
    // 현재 좌표와 가장 가까운 지역 찾기
    for (const region of regions) {
        if (lat >= region.lat[0] && lat <= region.lat[1] && 
            lon >= region.lon[0] && lon <= region.lon[1]) {
            return `${region.name} (추정)`;
        }
    }
    
    // 어떤 지역에도 해당하지 않으면 좌표 표시
    return `위도 ${lat.toFixed(2)}, 경도 ${lon.toFixed(2)}`;
}

// 메시지 업데이트 (AI 활용 여부 표시 개선)
function updateMessageWithAIIndicator(messageElement, text, isRealAI = false) {
    // AI 활용 여부에 따라 다른 스타일 적용
    if (isRealAI) {
        // 실제 AI 사용시
        messageElement.innerHTML = `
            <div class="ai-message-container">
                <div class="ai-indicator real-ai">🤖 AI 생성</div>
                <div class="message-text">${text}</div>
            </div>
        `;
        console.log('🤖 실제 AI 생성 메시지 표시');
    } else {
        // 메시지 조합 사용시
        messageElement.innerHTML = `
            <div class="ai-message-container">
                <div class="ai-indicator smart-compose">🧠 스마트 조합</div>
                <div class="message-text">${text}</div>
            </div>
        `;
        console.log('🧠 스마트 메시지 조합 표시');
    }
    
    // 동적 스타일 추가
    if (!document.getElementById('ai-message-styles')) {
        const style = document.createElement('style');
        style.id = 'ai-message-styles';
        style.textContent = `
            .ai-message-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }
            
            .ai-indicator {
                font-size: 0.75rem;
                padding: 4px 8px;
                border-radius: 12px;
                font-weight: 600;
                opacity: 0.8;
                transition: opacity 0.3s ease;
            }
            
            .ai-indicator.real-ai {
                background: linear-gradient(45deg, #4facfe, #00f2fe);
                color: white;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            }
            
            .ai-indicator.smart-compose {
                background: linear-gradient(45deg, #a8edea, #fed6e3);
                color: #333;
                border: 1px solid rgba(0,0,0,0.1);
            }
            
            .message-text {
                text-align: center;
                line-height: 1.4;
            }
            
            .ai-message-container:hover .ai-indicator {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }
}

// 통계 UI 업데이트 함수 제거됨 (메시지만 표시)

// 동기부여 메시지 생성 및 표시 - 개선된 버전
async function generateMotivationMessage() {
    const messageElement = document.getElementById('motivation-message');
    const refreshBtn = document.getElementById('motivation-refresh');
    const robotIcon = document.getElementById('ai-robot-icon');
    
    if (!messageElement || !currentProfile) return;
    
    try {
        // 로딩 상태 표시 (로봇 아이콘 회전 시작)
        refreshBtn?.classList.add('loading');
        messageElement.classList.add('generating');
        robotIcon?.classList.add('ai-thinking');
        
        // 운동 데이터 분석
        const exerciseData = await analyzeExerciseData(currentProfile);
        console.log(`📊 ${currentProfile} 운동 데이터 분석:`, exerciseData);
        
        // 현재 날씨 데이터 가져오기
        const weatherData = await getCurrentWeatherForAI();
        console.log('🌤️ 현재 날씨 데이터:', weatherData);
        
        if (exerciseData) {
            // 운동 데이터가 있는지 확인 (모든 값이 0이면 운동 이력 없음)
            const hasExerciseHistory = exerciseData.thisWeek > 0 || exerciseData.lastWeek > 0 || exerciseData.thisMonth > 0;
            
            if (hasExerciseHistory) {
                // 운동 이력이 있는 경우 - AI 프롬프트 생성
                const prompt = generateMotivationPrompt(exerciseData, weatherData);
                console.log(`🤖 ${currentProfile}님 맞춤 AI 프롬프트 (운동+날씨):`, prompt);
                
                // API 키 확인으로 실제 AI 사용 여부 판단
                const hasRealAI = HUGGINGFACE_API_KEY && HUGGINGFACE_API_KEY !== 'your_huggingface_api_key_here';
                
                if (hasRealAI) {
                    messageElement.textContent = `${currentProfile}님의 운동 기록과 날씨를 AI가 분석하여 맞춤 메시지를 생성하고 있습니다...`;
                } else {
                    messageElement.textContent = 'AI 메시지 생성을 준비중입니다...';
                    // 메시지 조합 모드임을 명확히 표시하기 위한 추가 지연
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                
                // AI 메시지 생성 (실제 AI 또는 스마트 조합)
                const result = await callHuggingFaceAPI(prompt);
                
                // 메시지 표시 (AI 활용 여부에 따라 다르게 표시)
                updateMessageWithAIIndicator(messageElement, result.message, result.isRealAI);
                
                if (result.isRealAI) {
                    console.log(`✅ 실제 AI로 ${currentProfile}님 맞춤 메시지 생성 완료:`, result.message);
                } else {
                    console.log(`✅ 스마트 메시지 조합으로 ${currentProfile}님 맞춤 메시지 생성 완료:`, result.message);
                }
            } else {
                // 운동 이력이 없는 경우 - 시작 격려 메시지
                console.log(`📝 ${currentProfile}님 운동 시작 격려 메시지 생성`);
                messageElement.textContent = 'AI 메시지 생성을 준비중입니다...';
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 운동 시작을 위한 특별 프롬프트 생성
                const startPrompt = `${currentProfile}는 아직 운동을 시작하지 않았습니다. 날씨: ${weatherData?.description || '좋음'}(${weatherData?.temperature || 20}°C). ${currentProfile}에게 운동 시작을 격려하는 따뜻한 메시지를 40자 이내로 작성해주세요.`;
                
                const result = await callHuggingFaceAPI(startPrompt);
                updateMessageWithAIIndicator(messageElement, result.message, result.isRealAI);
                
                console.log(`✅ ${currentProfile}님 운동 시작 격려 메시지 생성 완료:`, result.message);
            }
        } else {
            // 데이터 분석 실패시
            messageElement.textContent = `${currentProfile}님, 운동 기록을 더 쌓으시면 개인 맞춤형 메시지를 드릴 수 있어요! 💪`;
        }
        
    } catch (error) {
        console.error('❌ 동기부여 메시지 생성 실패:', error);
        updateMessageWithAIIndicator(messageElement, `${currentProfile}님, 오늘도 건강한 하루 만들어봐요! 화이팅! 💪`, false);
    } finally {
        // 로딩 상태 해제 (로봇 아이콘 회전 정지)
        refreshBtn?.classList.remove('loading');
        messageElement.classList.remove('generating');
        robotIcon?.classList.remove('ai-thinking');
    }
}

// 동기부여 새로고침 버튼 이벤트
function initMotivationRefreshButton() {
    const refreshBtn = document.getElementById('motivation-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            generateMotivationMessage();
        });
    }
}

// 동기부여 기능 초기화
function initMotivationFeature() {
    console.log('🤖 AI 동기부여 기능 초기화 시작');
    
    // 새로고침 버튼 이벤트 등록
    initMotivationRefreshButton();
    
    // 현재 프로필이 있으면 즉시 메시지 생성
    if (currentProfile) {
        generateMotivationMessage();
    }
    
    console.log('✅ AI 동기부여 기능 초기화 완료');
}
