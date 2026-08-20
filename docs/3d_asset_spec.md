# SoundVillage 3D asset specification

이 문서는 `/3d-prototype`의 placeholder를 Blender 제작 GLB로 교체하기 위한 납품 기준이다. 상업 게임에서 추출한 모델·텍스처·음원은 사용하지 않고 SoundVillage 전용 원본만 사용한다.

## 공통 제작 규칙

- 포맷: binary glTF 2.0 (`.glb`), Y-up, 1 unit = 1 meter
- 전방: 캐릭터와 방향성 소품 모두 Blender의 `-Z`를 전방으로 통일
- 원점: 캐릭터는 발 중앙, 사물은 바닥면 중앙
- 변환: 내보내기 전에 rotation/scale 적용, scale `(1, 1, 1)` 권장
- 메시: 숨은 메시, 제작용 컬렉션, 카메라, 조명 제거. 재질 수와 draw call은 최소화
- 텍스처: 일반 소품 512px 이하, 캐릭터·주요 건물 1024px 이하. 가능하면 atlas 사용
- 재질: PBR metallic-roughness. 과도한 투명/굴절/고비용 셰이더 금지
- 애니메이션: 필요한 clip만 포함하고 이름을 아래 표와 정확히 일치
- 압축: 최초 연결은 비압축 GLB도 허용한다. Draco/Meshopt를 쓰면 로더 설정도 함께 변경해야 한다.

## 모델별 명세

| asset key | 파일명 | 기준 크기 (m) | 원점 | 전방 | 애니메이션 | 런타임 collider | 텍스처 |
|---|---|---:|---|---|---|---|---:|
| `player` | `player.glb` | 높이 1.6 | 발 중앙 | -Z | `Idle`, `Walk`, `Interact` | 원형, 지름 0.84 | 1024px |
| `musicVillageHouse` | `music-village-house.glb` | 3.7 × 3.8 × 2.7 | 바닥 중앙 | -Z | 없음 | AABB 4.2 × 3.3 | 1024px |
| `soundMuseum` | `sound-museum.glb` | 4.0 × 4.2 × 2.8 | 바닥 중앙 | -Z | 없음 | AABB 4.5 × 3.3 | 1024px |
| `appleTree` | `apple-tree.glb` | 높이 3.1 | 줄기 바닥 중앙 | -Z | 없음 | AABB 1.4 × 1.4 | 512px |
| `flowerPink` | `flower-pink.glb` | 높이 0.45 | 줄기 바닥 중앙 | -Z | 없음 | 없음(통과 가능) | 512px |
| `flowerWhite` | `flower-white.glb` | 높이 0.45 | 줄기 바닥 중앙 | -Z | 없음 | 없음(통과 가능) | 512px |
| `woodenFence` | `wooden-fence.glb` | 2.0 × 0.9 × 0.2 | 바닥 중앙 | -Z | 없음 | AABB 2.0 × 0.35 | 512px |
| `bench` | `bench.glb` | 1.7 × 1.1 × 0.6 | 바닥 중앙 | -Z | 없음 | 없음(현재 통과 가능) | 512px |
| `soundOrb` | `sound-orb.glb` | 지름 0.85 | 중심 | -Z | `Interact` 선택 | 상호작용 반경 1.6 | 512px |
| `lampPost` | `lamp-post.glb` | 높이 1.9 | 기둥 바닥 중앙 | -Z | 없음 | 없음(현재 통과 가능) | 512px |

## 납품 및 연결

완성된 파일은 `public/models/3d/`에 위 파일명 그대로 둔다. 이어서 `lib/three/assetManifest.mjs`에서 대상 항목의 `enabled`를 검토하고, 프로토타입의 `loadModel` 정책을 production 설정으로 전환한다. 모델의 보이는 크기나 방향은 manifest의 `scale`, `rotation`, `positionOffset`으로 미세 조정하되 collider는 `lib/three/modelConfig.mjs`와 함께 검증한다.

Blender 원본 `.blend`, 고해상도 소스 텍스처, 베이크 중간 산출물은 웹 런타임이 아니다. 일반 Git 대신 Git LFS 또는 별도 제작 스토리지에 보관한다.
