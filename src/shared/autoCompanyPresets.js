const AUTO_COMPANY_PRESETS = {
  version: '2025-01-12',
  regions: {
    '경기': {
      '전기': [
        { name: '이엘케이', allowSolo: false },
        { name: '엠라이테크', allowSolo: false },
        { name: '신우이엔아이', allowSolo: false },
        { name: '동해전기공사', allowSolo: false },
        {
          name: '대한종합산전',
          allowSolo: false,
          requiredRole: 'leader',
          partnerRules: [
            { partner: '일광이엔씨', relation: 'avoid-pair', notes: '세트로 불리지만 별도로 사용 권장' }
          ],
        },
        {
          name: '일광이엔씨',
          allowSolo: false,
          requiredRole: 'member',
          notes: '대한종합산전과 같은 프로젝트에서 구성사로 사용'
        },
        {
          name: '녹십자이엠',
          requireDutyShare: true,
          minShareAmount: 1000000000,
          notes: '의무지분 배정액이 10억 이상일 때만 사용'
        },
        { name: '남양계전', requiredRole: 'leader', allowSolo: false },
        {
          name: '은성산업',
          disallowedOwners: ['LH'],
          notes: 'LH 비회원사이므로 LH 공고 제외'
        },
        {
          name: '코원건설',
          minEstimatedAmount: 2000000000,
          notes: '추정금액 20억 이상 공사만'
        },
      ],
      '소방': [
        { name: '대상전력', allowSolo: false },
        { name: '신우이엔아이', allowSolo: false },
        { name: '대원전력공사', allowSolo: false },
        { name: '김호건설', allowSolo: false },
        { name: '은성산업', disallowedOwners: ['LH'], notes: 'LH 제외' },
        {
          name: '녹십자이엠',
          requireDutyShare: true,
          minShareAmount: 1000000000,
          notes: '의무지분 10억 이상'
        },
        { name: '코원건설', minEstimatedAmount: 2000000000, notes: '추정 20억 이상' },
        { name: '파워텔레콤', allowSolo: false },
      ],
      '통신': [
        { name: '건양전기신호', allowSolo: false },
        { name: '유티정보', allowSolo: false },
        { name: '온세이엔씨', allowSolo: false, requiredRole: 'leader' },
        {
          name: '세진종합이엔씨',
          allowSolo: false,
          partnerRules: [
            { partner: '부현전기', relation: 'requires', partnerRole: 'leader', notes: '세진 사용 시 부현전기 대표사로' }
          ],
        },
        { name: '대상전력', allowSolo: false },
        { name: '트래콘건설', allowSolo: false },
        { name: '광원', allowSolo: false },
        { name: '개성건설', allowSolo: false },
        { name: '코원건설', minEstimatedAmount: 2000000000, notes: '추정 20억 이상' },
        { name: '에쓰엔씨정보기술', allowSolo: true },
        { name: '만양', allowSolo: false },
        {
          name: '유리시스템즈',
          allowSolo: false,
          partnerRules: [
            { partner: '하나전기', relation: 'requires', partnerRole: 'leader', notes: '하나전기를 대표사로 배치' }
          ],
        },
        { name: '부현전기', requiredRole: 'leader', allowSolo: false },
        { name: '하나전기', requiredRole: 'leader', allowSolo: false },
      ],
    },
    '서울': {
      '전기': [
        {
          name: '에스지씨이앤씨',
          minEstimatedAmount: 5000000000,
          minShareAmount: 3000000000,
          notes: '추정 50억 이상, 배정 지분 30억 이상'
        },
        { name: '도화엔지니어링', notes: '단독 가능해도 구성사로 사용 가능' },
        { name: '도원이엔아이', notes: '단독 가능해도 구성사로 사용 가능' },
        { name: '영웅개발', allowSolo: false },
        { name: '정준테크', allowSolo: false },
        { name: '태호ENG', allowSolo: false },
        { name: '강남이엔씨', allowSolo: false },
        {
          name: '특수건설',
          notes: '단독 가능해도 협정 가능, 의무지분만큼 정확히 배정'
        },
      ],
      '소방': [
        {
          name: '에스지씨이앤씨',
          minEstimatedAmount: 5000000000,
          minShareAmount: 3000000000,
          notes: '추정 50억 이상, 지분 30억 이상'
        },
        { name: '도화엔지니어링', notes: '구성사로 사용 가능' },
        { name: '도원이엔아이', notes: '구성사로 사용 가능' },
        {
          name: '파르이앤씨',
          allowSolo: false,
          partnerRules: [
            { partner: '부현전기', relation: 'requires', partnerRole: 'leader', notes: '부현전기를 대표사로' }
          ],
        },
        { name: '재윤전기', allowSolo: false },
        { name: '태건전설', allowSolo: false },
        { name: '연일전력', allowSolo: false },
      ],
      '통신': [
        {
          name: '에스지씨이앤씨',
          minEstimatedAmount: 5000000000,
          minShareAmount: 3000000000,
          notes: '추정 50억 이상'
        },
        { name: '도화엔지니어링', notes: '구성사 사용 가능' },
        { name: '도원이엔아이', notes: '구성사 사용 가능' },
        {
          name: '파르이앤씨',
          allowSolo: false,
          partnerRules: [
            { partner: '부현전기', relation: 'requires', partnerRole: 'leader' }
          ],
        },
        { name: '이화공영', notes: '제한 없음' },
      ],
    },
    '인천': {
      '전기': [
        { name: '새천년이엔씨', allowSolo: false },
        { name: '청운전기', allowSolo: false },
        {
          name: '대건전기제어',
          partnerRules: [
            { partner: '에코엠이엔씨', relation: 'paired', notes: '고정 협정, 의무지분 정확히 배정' }
          ],
        },
        { name: '에코엠이엔씨', requiredRole: 'leader' },
      ],
      '소방': [
        { name: '건화티에스', allowSolo: true },
      ],
      '통신': [
        { name: '새천년이엔씨', allowSolo: false },
        { name: '건화티에스', allowSolo: false },
        { name: '선경기전', notes: '단독 가능해도 협정 가능' },
        { name: '성원이앤에프', notes: '단독 가능해도 협정 가능' },
      ],
    },
    '강원': {
      '전기': [
        { name: '보혜전력', allowSolo: false, requiredRole: 'leader' },
        { name: '한라전설', allowSolo: false },
      ],
      '소방': [
        { name: '세진전설', allowSolo: false },
      ],
      '통신': [
        {
          name: '큐센텍',
          allowSolo: false,
          disallowedOwners: ['행안부'],
          notes: '행안부 제외 사용 가능'
        },
        { name: '세진전설', allowSolo: false },
        { name: '부원전기', allowSolo: false },
      ],
    },
    '충남': {
      '전기': [ { name: '동성건설', allowSolo: false } ],
      '소방': [ { name: '동성건설', allowSolo: false } ],
      '통신': [
        { name: '동성건설', allowSolo: false },
        { name: '화승전력', allowSolo: false },
        { name: '송암산업', allowSolo: false },
        { name: '경동이앤지', allowSolo: false },
      ],
    },
    '충북': {
      '전기': [
        { name: '티에스이엔지', allowSolo: false, partnerRules: [{ partner: '지음이엔아이', relation: 'requires', partnerRole: 'leader' }] },
        {
          name: '제이티',
          allowSolo: false,
          ownerOverrides: [
            {
              owners: ['행안부', '조달청'],
              fixedShares: [
                { partner: '대흥디씨티', share: 40, role: 'member' },
                { partner: '제이티', share: 60, role: 'leader' }
              ]
            }
          ]
        },
        {
          name: '좋은이엔지',
          notes: '단독 가능해도 협정 가능',
          partnerRules: [
            { partner: '에코엠이엔씨', relation: 'requires', partnerRole: 'leader' }
          ]
        },
        { name: '누리온전력', allowSolo: false },
        { name: '지음이엔아이', requiredRole: 'leader' },
        { name: '대흥디씨티', requiredRole: 'member' },
        { name: '에코엠이엔씨', requiredRole: 'leader' },
      ],
      '소방': [ { name: '신광전력', allowSolo: false } ],
      '통신': [],
    },
    '대전': {
      '전기': [
        { name: '코레일테크', notes: '단독 가능해도 협정 가능' },
        { name: '정운아이티씨', allowSolo: false },
        { name: '영인산업', allowSolo: false },
        { name: '해성테크', allowSolo: false, requiredRole: 'leader' },
      ],
      '소방': [ { name: '코레일테크', notes: '단독 가능해도 협정 가능' } ],
      '통신': [ { name: '코레일테크', notes: '단독 가능해도 협정 가능' } ],
    },
    '부산': { '전기': [], '소방': [], '통신': [] },
    '경남': {
      '전기': [
        { name: '태임전설', allowSolo: false },
        { name: '케이지건설', allowSolo: false },
      ],
      '소방': [ { name: '렉터슨', allowSolo: false } ],
      '통신': [
        { name: '렉터슨', allowSolo: false },
        { name: '태임넌설', allowSolo: false },
      ],
    },
    '경북': {
      '전기': [
        { name: '삼광전설', allowSolo: false },
        { name: '보명산업개발', allowSolo: false, requiredRole: 'leader' },
        { name: '동해전력', allowSolo: false, requiredRole: 'leader', defaultShare: 60 },
        { name: '국기건설', allowSolo: false },
      ],
      '소방': [ { name: '삼원종합전기', allowSolo: false } ],
      '통신': [],
    },
    '전남': {
      '전기': [
        { name: '해동건설', allowSolo: false },
        { name: '남도건설', allowSolo: false },
        { name: '학림건설', partnerRules: [{ partner: '에코엠이엔씨', relation: 'requires', partnerRole: 'leader' }] },
        { name: '새천년종합건설', notes: '단독 가능해도 협정 가능', partnerRules: [{ partner: '우진일렉트', relation: 'requires', partnerRole: 'leader' }] },
        { name: '덕흥건설', notes: '단독 가능해도 협정 가능', partnerRules: [{ partner: '아람이엔테크', relation: 'requires', partnerRole: 'leader' }] },
        { name: '우진일렉트', requiredRole: 'leader' },
        { name: '아람이엔테크', requiredRole: 'leader' },
      ],
      '소방': [
        { name: '해동건설', allowSolo: false },
        { name: '새천년종합건설', notes: '단독 가능해도 협정 가능', partnerRules: [{ partner: '우진일렉트', relation: 'requires', partnerRole: 'leader' }] },
        { name: '덕흥건설', notes: '단독 가능해도 협정 가능', partnerRules: [{ partner: '아람이엔테크', relation: 'requires', partnerRole: 'leader' }] },
      ],
      '통신': [
        { name: '해동건설', allowSolo: false },
        { name: '학림건설', allowSolo: false, notes: '30억 이하는 대표사로', requiredRole: 'leader', maxEstimatedAmount: 3000000000 },
        { name: '새천년종합건설', notes: '단독 가능해도 협정 가능', partnerRules: [{ partner: '우진일렉트', relation: 'requires', partnerRole: 'leader' }] },
      ],
    },
    '전북': { '전기': [], '소방': [], '통신': [] },
    '울산': {
      '전기': [
        { name: '라인이엔지', allowSolo: false },
        { name: '성전사', notes: '단독 가능해도 협정 가능' },
      ],
      '소방': [ { name: '성전사', allowSolo: false } ],
      '통신': [ { name: '성전사', allowSolo: false } ],
    },
    '광주': {
      '전기': [
        { name: '로제비앙건설', allowSolo: false },
        { name: '남광건설', allowSolo: false },
        { name: '대광건영', allowSolo: false, minShareAmount: 500000000, notes: '지분 5억 이상 배정 시 사용' },
      ],
      '소방': [ { name: '로제비앙건설', allowSolo: false } ],
      '통신': [ { name: '로제비앙건설', allowSolo: false } ],
    },
    '대구': { '전기': [], '소방': [], '통신': [] },
    '세종': { '전기': [], '소방': [], '통신': [] },
    '제주': { '전기': [], '소방': [], '통신': [] },
  },
};

export default AUTO_COMPANY_PRESETS;
