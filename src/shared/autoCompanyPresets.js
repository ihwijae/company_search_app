const AUTO_COMPANY_PRESETS = {
  "version": "2025-01-12",
  "regions": {
    "경기": {
      "전기": [
        {
          "name": "이엘케이",
          "allowSolo": false,
          "bizNo": "128-81-56359"
        },
        {
          "name": "엠라이테크",
          "allowSolo": false,
          "bizNo": "218-81-12450"
        },
        {
          "name": "신우이엔아이",
          "allowSolo": false,
          "bizNo": "127-81-87989"
        },
        {
          "name": "동해전기공사",
          "allowSolo": false,
          "bizNo": "132-01-94739"
        },
        {
          "name": "대한종합산전",
          "allowSolo": false,
          "requiredRole": "leader",
          "partnerRules": [
            {
              "partner": "일광이앤씨",
              "relation": "avoid-pair",
              "notes": "세트로 불리지만 별도로 사용 권장"
            }
          ],
          "bizNo": "105-81-62163"
        },
        {
          "name": "일광이앤씨",
          "allowSolo": false,
          "requiredRole": "member",
          "notes": "대한종합산전과 같은 프로젝트에서 구성사로 사용",
          "bizNo": "612-87-00347"
        },
        {
          "name": "녹십자이엠",
          "requireDutyShare": true,
          "minShareAmount": 1000000000,
          "notes": "의무지분 배정액이 10억 이상일 때만 사용",
          "bizNo": "135-81-44619"
        },
        {
          "name": "남양계전",
          "requiredRole": "leader",
          "allowSolo": false,
          "bizNo": "202-81-36758"
        },
        {
          "name": "은성산업",
          "disallowedOwners": [
            "LH"
          ],
          "notes": "LH 비회원사이므로 LH 공고 제외",
          "bizNo": "133-81-22735"
        },
        {
          "name": "코원건설",
          "minEstimatedAmount": 2000000000,
          "notes": "추정금액 20억 이상 공사만",
          "bizNo": "123-81-78983"
        }
      ],
      "소방": [
        {
          "name": "대상전력",
          "allowSolo": false,
          "bizNo": "216-81-15499"
        },
        {
          "name": "신우이엔아이",
          "allowSolo": false,
          "bizNo": "127-81-87989"
        },
        {
          "name": "대원전력공사",
          "allowSolo": false,
          "bizNo": "124-86-11641"
        },
        {
          "name": "김호건설",
          "allowSolo": false,
          "bizNo": "101-81-63743"
        },
        {
          "name": "은성산업",
          "disallowedOwners": [
            "LH"
          ],
          "notes": "LH 제외",
          "bizNo": "133-81-22735"
        },
        {
          "name": "녹십자이엠",
          "requireDutyShare": true,
          "minShareAmount": 1000000000,
          "notes": "의무지분 10억 이상",
          "bizNo": "135-81-44619"
        },
        {
          "name": "코원건설",
          "minEstimatedAmount": 2000000000,
          "notes": "추정 20억 이상",
          "bizNo": "123-81-78983"
        },
        {
          "name": "파워텔레콤",
          "allowSolo": false,
          "bizNo": "124-86-25392"
        }
      ],
      "통신": [
        {
          "name": "건양전기신호",
          "allowSolo": false,
          "bizNo": "209-81-32016"
        },
        {
          "name": "유티정보",
          "allowSolo": false,
          "bizNo": "124-81-84571"
        },
        {
          "name": "온세이엔씨",
          "allowSolo": false,
          "requiredRole": "leader",
          "bizNo": "142-81-28387"
        },
        {
          "name": "세진종합이엔씨",
          "allowSolo": false,
          "partnerRules": [
            {
              "partner": "부현전기",
              "relation": "requires",
              "partnerRole": "leader",
              "notes": "세진 사용 시 부현전기 대표사로"
            }
          ],
          "bizNo": "119-86-65219"
        },
        {
          "name": "대상전력",
          "allowSolo": false,
          "bizNo": "216-81-15499"
        },
        {
          "name": "트래콘건설",
          "allowSolo": false,
          "bizNo": "214-81-64674"
        },
        {
          "name": "광원",
          "allowSolo": false,
          "bizNo": "774-87-02279"
        },
        {
          "name": "개성건설",
          "allowSolo": false,
          "bizNo": "110-81-31639"
        },
        {
          "name": "코원건설",
          "minEstimatedAmount": 2000000000,
          "notes": "추정 20억 이상",
          "bizNo": "123-81-78983"
        },
        {
          "name": "에쓰엔씨정보기술",
          "allowSolo": true,
          "bizNo": "138-81-38998"
        },
        {
          "name": "만양",
          "allowSolo": false,
          "bizNo": "126-86-50320"
        },
        {
          "name": "유리시스템즈",
          "allowSolo": false,
          "partnerRules": [
            {
              "partner": "하나전기",
              "relation": "requires",
              "partnerRole": "leader",
              "notes": "하나전기를 대표사로 배치"
            }
          ],
          "bizNo": "305-81-91201"
        },
        {
          "name": "부현전기",
          "requiredRole": "leader",
          "allowSolo": false,
          "bizNo": "118-81-21173"
        },
        {
          "name": "하나전기",
          "requiredRole": "leader",
          "allowSolo": false,
          "bizNo": "214-81-22183"
        }
      ]
    },
    "서울": {
      "전기": [
        {
          "name": "에스지씨이앤씨",
          "minEstimatedAmount": 5000000000,
          "minShareAmount": 3000000000,
          "notes": "추정 50억 이상, 배정 지분 30억 이상",
          "bizNo": "214-81-89369"
        },
        {
          "name": "도화엔지니어링",
          "notes": "단독 가능해도 구성사로 사용 가능",
          "bizNo": "211-81-08009"
        },
        {
          "name": "도원이엔아이",
          "notes": "단독 가능해도 구성사로 사용 가능",
          "bizNo": "128-81-72024"
        },
        {
          "name": "영웅개발",
          "allowSolo": false,
          "bizNo": "137-81-98727"
        },
        {
          "name": "정준테크",
          "allowSolo": false,
          "bizNo": "185-81-02351"
        },
        {
          "name": "태호ENG",
          "allowSolo": false,
          "bizNo": "358-58-00424"
        },
        {
          "name": "강남이엔씨",
          "allowSolo": false,
          "bizNo": "141-81-26649"
        },
        {
          "name": "특수건설",
          "notes": "단독 가능해도 협정 가능, 의무지분만큼 정확히 배정",
          "bizNo": "203-81-46827"
        }
      ],
      "소방": [
        {
          "name": "에스지씨이앤씨",
          "minEstimatedAmount": 5000000000,
          "minShareAmount": 3000000000,
          "notes": "추정 50억 이상, 지분 30억 이상",
          "bizNo": "214-81-89369"
        },
        {
          "name": "도화엔지니어링",
          "notes": "구성사로 사용 가능",
          "bizNo": "211-81-08009"
        },
        {
          "name": "도원이엔아이",
          "notes": "구성사로 사용 가능",
          "bizNo": "128-81-72024"
        },
        {
          "name": "파르이앤씨",
          "allowSolo": false,
          "partnerRules": [
            {
              "partner": "부현전기",
              "relation": "requires",
              "partnerRole": "leader",
              "notes": "부현전기를 대표사로"
            }
          ],
          "bizNo": "803-86-00460"
        },
        {
          "name": "재윤전기",
          "allowSolo": false,
          "bizNo": "104-81-53657"
        },
        {
          "name": "태건전설",
          "allowSolo": false,
          "bizNo": "109-86-10551"
        },
        {
          "name": "연일전력",
          "allowSolo": false,
          "bizNo": "212-81-66939"
        }
      ],
      "통신": [
        {
          "name": "에스지씨이앤씨",
          "minEstimatedAmount": 5000000000,
          "minShareAmount": 3000000000,
          "notes": "추정 50억 이상",
          "bizNo": "214-81-89369"
        },
        {
          "name": "도화엔지니어링",
          "notes": "구성사 사용 가능",
          "bizNo": "211-81-08009"
        },
        {
          "name": "도원이엔아이",
          "notes": "구성사 사용 가능",
          "bizNo": "128-81-72024"
        },
        {
          "name": "파르이앤씨",
          "allowSolo": false,
          "partnerRules": [
            {
              "partner": "부현전기",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "803-86-00460"
        },
        {
          "name": "이화공영",
          "notes": "제한 없음",
          "bizNo": "105-81-11500"
        }
      ]
    },
    "인천": {
      "전기": [
        {
          "name": "새천년이엔씨",
          "allowSolo": false,
          "bizNo": "121-81-66104"
        },
        {
          "name": "청운전기",
          "allowSolo": false,
          "bizNo": "894-87-00065"
        },
        {
          "name": "대건전기제어",
          "partnerRules": [
            {
              "partner": "에코엠이엔씨",
              "relation": "paired",
              "notes": "고정 협정, 의무지분 정확히 배정"
            }
          ],
          "bizNo": "122-81-88867"
        },
        {
          "name": "에코엠이엔씨",
          "requiredRole": "leader",
          "bizNo": "107-87-75007"
        }
      ],
      "소방": [
        {
          "name": "건화티에스",
          "allowSolo": true,
          "bizNo": "131-81-53299"
        }
      ],
      "통신": [
        {
          "name": "새천년이엔씨",
          "allowSolo": false,
          "bizNo": "121-81-66104"
        },
        {
          "name": "건화티에스",
          "allowSolo": false,
          "bizNo": "131-81-53299"
        },
        {
          "name": "선경기전",
          "notes": "단독 가능해도 협정 가능",
          "bizNo": "122-86-42172"
        },
        {
          "name": "성원이앤에프",
          "notes": "단독 가능해도 협정 가능",
          "bizNo": "864-88-02701"
        }
      ]
    },
    "강원": {
      "전기": [
        {
          "name": "보혜전력",
          "allowSolo": false,
          "requiredRole": "leader",
          "bizNo": "685-87-00670"
        },
        {
          "name": "한라전설",
          "allowSolo": false,
          "bizNo": "819-87-01684"
        }
      ],
      "소방": [
        {
          "name": "세진전설",
          "allowSolo": false,
          "bizNo": "127-81-84508"
        }
      ],
      "통신": [
        {
          "name": "큐센텍",
          "allowSolo": false,
          "disallowedOwners": [
            "행안부"
          ],
          "notes": "행안부 제외 사용 가능",
          "bizNo": "206-86-30824"
        },
        {
          "name": "세진전설",
          "allowSolo": false,
          "bizNo": "127-81-84508"
        },
        {
          "name": "부원전기",
          "allowSolo": false,
          "bizNo": "218-81-08562"
        }
      ]
    },
    "충남": {
      "전기": [
        {
          "name": "동성건설",
          "allowSolo": false,
          "bizNo": "308-81-04379"
        }
      ],
      "소방": [
        {
          "name": "동성건설",
          "allowSolo": false,
          "bizNo": "308-81-04379"
        }
      ],
      "통신": [
        {
          "name": "동성건설",
          "allowSolo": false,
          "bizNo": "308-81-04379"
        },
        {
          "name": "화승전력",
          "allowSolo": false,
          "bizNo": "314-86-43386"
        },
        {
          "name": "송암산업",
          "allowSolo": false,
          "bizNo": "610-81-63892"
        },
        {
          "name": "경동이앤지",
          "allowSolo": false,
          "bizNo": "311-81-48126"
        }
      ]
    },
    "충북": {
      "전기": [
        {
          "name": "티에스이엔지",
          "allowSolo": false,
          "partnerRules": [
            {
              "partner": "지음이엔아이",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "806-86-01380"
        },
        {
          "name": "제이티",
          "allowSolo": false,
          "ownerOverrides": [
            {
              "owners": [
                "행안부",
                "조달청"
              ],
              "fixedShares": [
                {
                  "partner": "대흥디씨티",
                  "share": 40,
                  "role": "member"
                },
                {
                  "partner": "제이티",
                  "share": 60,
                  "role": "leader"
                }
              ]
            }
          ],
          "bizNo": "301-86-24670"
        },
        {
          "name": "좋은이엔지",
          "notes": "단독 가능해도 협정 가능",
          "partnerRules": [
            {
              "partner": "에코엠이엔씨",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "303-81-44454"
        },
        {
          "name": "누리온전력",
          "allowSolo": false,
          "bizNo": "461-81-03104"
        },
        {
          "name": "지음이엔아이",
          "requiredRole": "leader",
          "bizNo": "132-81-79967"
        },
        {
          "name": "대흥디씨티",
          "requiredRole": "member",
          "bizNo": "127-81-95155"
        },
        {
          "name": "에코엠이엔씨",
          "requiredRole": "leader",
          "bizNo": "107-87-75007"
        }
      ],
      "소방": [
        {
          "name": "신광전력",
          "allowSolo": false,
          "bizNo": "410-86-19767"
        }
      ],
      "통신": []
    },
    "대전": {
      "전기": [
        {
          "name": "코레일테크",
          "notes": "단독 가능해도 협정 가능",
          "bizNo": "305-81-73178"
        },
        {
          "name": "정운아이티씨",
          "allowSolo": false,
          "bizNo": "499-87-02117"
        },
        {
          "name": "영인산업",
          "allowSolo": false,
          "bizNo": "314-81-58512"
        },
        {
          "name": "해성테크",
          "allowSolo": false,
          "requiredRole": "leader",
          "bizNo": "285-81-03475"
        }
      ],
      "소방": [
        {
          "name": "코레일테크",
          "notes": "단독 가능해도 협정 가능",
          "bizNo": "305-81-73178"
        }
      ],
      "통신": [
        {
          "name": "코레일테크",
          "notes": "단독 가능해도 협정 가능",
          "bizNo": "305-81-73178"
        }
      ]
    },
    "부산": {
      "전기": [],
      "소방": [],
      "통신": []
    },
    "경남": {
      "전기": [
        {
          "name": "태임전설",
          "allowSolo": false,
          "bizNo": "517-81-00415"
        },
        {
          "name": "케이지건설",
          "allowSolo": false,
          "bizNo": "608-81-10048"
        }
      ],
      "소방": [
        {
          "name": "렉터슨",
          "allowSolo": false,
          "bizNo": "220-81-92122"
        }
      ],
      "통신": [
        {
          "name": "렉터슨",
          "allowSolo": false,
          "bizNo": "220-81-92122"
        },
        {
          "name": "태임넌설",
          "allowSolo": false
        }
      ]
    },
    "경북": {
      "전기": [
        {
          "name": "삼광전설",
          "allowSolo": false,
          "bizNo": "713-81-02063"
        },
        {
          "name": "보명산업개발",
          "allowSolo": false,
          "requiredRole": "leader",
          "bizNo": "305-86-12346"
        },
        {
          "name": "동해전력",
          "allowSolo": false,
          "requiredRole": "leader",
          "defaultShare": 60,
          "bizNo": "506-81-70721"
        },
        {
          "name": "국기건설",
          "allowSolo": false,
          "bizNo": "222-81-04584"
        }
      ],
      "소방": [
        {
          "name": "삼원종합전기",
          "allowSolo": false,
          "bizNo": "129-81-47265"
        }
      ],
      "통신": []
    },
    "전남": {
      "전기": [
        {
          "name": "해동건설",
          "allowSolo": false,
          "bizNo": "417-81-03015"
        },
        {
          "name": "남도건설",
          "allowSolo": false,
          "bizNo": "408-81-00300"
        },
        {
          "name": "학림건설",
          "partnerRules": [
            {
              "partner": "에코엠이엔씨",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "415-81-01350"
        },
        {
          "name": "새천년종합건설",
          "notes": "단독 가능해도 협정 가능",
          "partnerRules": [
            {
              "partner": "우진일렉트",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "414-81-02642"
        },
        {
          "name": "덕흥건설",
          "notes": "단독 가능해도 협정 가능",
          "partnerRules": [
            {
              "partner": "아람이엔테크",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "412-81-09289"
        },
        {
          "name": "우진일렉트",
          "requiredRole": "leader",
          "bizNo": "135-81-40632"
        },
        {
          "name": "아람이엔테크",
          "requiredRole": "leader",
          "bizNo": "119-86-35582"
        }
      ],
      "소방": [
        {
          "name": "해동건설",
          "allowSolo": false,
          "bizNo": "417-81-03015"
        },
        {
          "name": "새천년종합건설",
          "notes": "단독 가능해도 협정 가능",
          "partnerRules": [
            {
              "partner": "우진일렉트",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "414-81-02642"
        },
        {
          "name": "덕흥건설",
          "notes": "단독 가능해도 협정 가능",
          "partnerRules": [
            {
              "partner": "아람이엔테크",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "412-81-09289"
        }
      ],
      "통신": [
        {
          "name": "해동건설",
          "allowSolo": false,
          "bizNo": "417-81-03015"
        },
        {
          "name": "학림건설",
          "allowSolo": false,
          "notes": "30억 이하는 대표사로",
          "requiredRole": "leader",
          "maxEstimatedAmount": 3000000000,
          "bizNo": "415-81-01350"
        },
        {
          "name": "새천년종합건설",
          "notes": "단독 가능해도 협정 가능",
          "partnerRules": [
            {
              "partner": "우진일렉트",
              "relation": "requires",
              "partnerRole": "leader"
            }
          ],
          "bizNo": "414-81-02642"
        }
      ]
    },
    "전북": {
      "전기": [],
      "소방": [],
      "통신": []
    },
    "울산": {
      "전기": [
        {
          "name": "라인이엔지",
          "allowSolo": false,
          "bizNo": "508-81-11989"
        },
        {
          "name": "성전사",
          "notes": "단독 가능해도 협정 가능",
          "bizNo": "620-81-06559"
        }
      ],
      "소방": [
        {
          "name": "성전사",
          "allowSolo": false,
          "bizNo": "620-81-06559"
        }
      ],
      "통신": [
        {
          "name": "성전사",
          "allowSolo": false,
          "bizNo": "620-81-06559"
        }
      ]
    },
    "광주": {
      "전기": [
        {
          "name": "로제비앙건설",
          "allowSolo": false,
          "bizNo": "410-86-11843"
        },
        {
          "name": "남광건설",
          "allowSolo": false,
          "bizNo": "408-81-00391"
        },
        {
          "name": "대광건영",
          "allowSolo": false,
          "minShareAmount": 500000000,
          "notes": "지분 5억 이상 배정 시 사용",
          "bizNo": "410-81-74561"
        }
      ],
      "소방": [
        {
          "name": "로제비앙건설",
          "allowSolo": false,
          "bizNo": "410-86-11843"
        }
      ],
      "통신": [
        {
          "name": "로제비앙건설",
          "allowSolo": false,
          "bizNo": "410-86-11843"
        }
      ]
    },
    "대구": {
      "전기": [],
      "소방": [],
      "통신": []
    },
    "세종": {
      "전기": [],
      "소방": [],
      "통신": []
    },
    "제주": {
      "전기": [],
      "소방": [],
      "통신": []
    }
  }
};
export default AUTO_COMPANY_PRESETS;
