import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getCirculation } from "../api/memories";
import {
  getMyRecordMap,
  type CityPin,
  type MapPlaceItem,
} from "../api/recordMap";
import type { CirculationCard, FlowerCode } from "../api/types";
import BottomTabs, { BOTTOM_TABS_SPACE } from "../components/BottomTabs";
import Flower from "../components/Flower";
import { getRoomSession } from "../lib/session";
import { paths } from "../routes/paths";

// 대구·경북이 들어오는 범위 (경도·위도). 울릉도는 오른쪽 끝에 붙여 보여준다
const LNG_MIN = 127.8;
const LNG_MAX = 129.7;
const LAT_MIN = 35.55;
const LAT_MAX = 37.15;

/** 좌표를 지도 상자 안의 % 위치로 바꾼다 */
function project(lat: number, lng: number) {
  const x = ((Math.min(lng, LNG_MAX) - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * 100;
  return { x: Math.max(6, Math.min(94, x)), y: Math.max(6, Math.min(94, y)) };
}

const CITY_FLOWERS: FlowerCode[] = [
  "AZALEA",
  "FORSYTHIA",
  "FORGET_ME_NOT",
  "TEAL",
  "PURPLE",
  "CANOLA",
  "LILAC",
  "ROYAL_AZALEA",
];

/** 도시 이름으로 늘 같은 꽃을 고른다 */
function cityFlower(city: string): FlowerCode {
  let hash = 0;
  for (const ch of city) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CITY_FLOWERS[hash % CITY_FLOWERS.length];
}

// 대구·경북 대략의 윤곽 (위 범위를 0~100으로 본 좌표)
const LAND_PATH =
  "M30 6 L52 3 L72 8 L86 4 L95 14 L93 34 L96 52 L93 70 L97 84 L88 96 L66 94 L48 98 L34 92 L22 96 L12 84 L16 70 L6 58 L12 44 L4 30 L14 18 Z";

/** 기록 지도 바텀시트의 사진 한 장: 사진·장소·방, 그리고 덧붙이기 또는 답가로 가는 버튼 */
function PlacePhotoCard({
  place,
  roomName,
  completed,
  card,
  onGo,
}: {
  place: MapPlaceItem;
  roomName: string;
  completed: boolean;
  card: CirculationCard | undefined;
  onGo: (path: string) => void;
}) {
  const canOpen = Boolean(getRoomSession(place.roomId));
  const own = card?.myResponse.status === "OWN_PHOTO";
  const added = card?.myResponse.status === "ADDON";
  const uploader = card?.photo.uploader;

  let action: { label: string; path: string } | null = null;
  let note = "";
  if (!canOpen) note = "이 기기에서 들어간 방이 아니라 열 수 없어요";
  else if (completed)
    action = {
      label: "이 문단에 답가 남기기",
      path: paths.roomScrollReply(place.roomId, place.photoId),
    };
  else if (own) note = "내가 올린 사진이에요";
  else
    action = {
      label: added ? "덧붙인 이야기 보기" : "이 사진에 덧붙이기",
      path: paths.roomCirculation(place.roomId, place.photoId),
    };

  return (
    <div className="rounded-[18px] border border-line bg-surface p-3">
      <div className="flex gap-3">
        {/* 사진은 작은 썸네일로: 못 불러오면 빈 칸 */}
        {card?.photo.imageUrl ? (
          <img
            src={card.photo.imageUrl}
            alt={`${place.placeName}에서 찍은 사진`}
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
            className="size-[72px] shrink-0 rounded-[12px] bg-[#efe9df] object-cover"
          />
        ) : (
          <span
            className="size-[72px] shrink-0 rounded-[12px] bg-gradient-to-br from-[#f2c9b8] to-[#8e6a86]"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">📍 {place.placeName}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-sub">
            {uploader && <Flower code={uploader.flowerCode} size={14} />}
            {roomName}
            {uploader && ` · ${own ? "내" : `${uploader.nickname}님`} 사진`}
            {completed && " · 두루마리 완성"}
          </p>
          {card?.firstEntry && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-[18px]">
              “{card.firstEntry.transcript}”
            </p>
          )}
        </div>
      </div>
      {action ? (
        <button
          type="button"
          onClick={() => onGo(action.path)}
          className="mt-2.5 h-10 w-full rounded-full bg-point text-[13px] font-semibold text-surface active:opacity-80"
        >
          {action.label}
        </button>
      ) : (
        <p className="mt-2.5 text-center text-[12px] text-muted">{note}</p>
      )}
    </div>
  );
}

function CitySheet({ pin, onClose }: { pin: CityPin; onClose: () => void }) {
  const navigate = useNavigate();
  // 지도 응답에는 사진 주소가 없어서, 그 방의 돌려보기 목록에서 사진·올린 사람·내 상태를 가져온다
  const [photoCards, setPhotoCards] = useState<Record<string, CirculationCard>>(
    {},
  );
  useEffect(() => {
    let active = true;
    const roomIds = [...new Set(pin.places.map((p) => p.roomId))];
    roomIds.forEach((roomId) => {
      const session = getRoomSession(roomId);
      if (!session) return;
      getCirculation(roomId, session.memberAccessToken)
        .then((cards) => {
          if (!active) return;
          setPhotoCards((prev) => ({
            ...prev,
            ...Object.fromEntries(cards.map((c) => [c.photo.id, c])),
          }));
        })
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [pin]);
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end bg-black/25"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[75dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2.5 pb-8 text-ink"
      >
        <span
          className="mx-auto block h-1 w-9 rounded-full bg-line"
          aria-hidden="true"
        />
        <h2 id="city-sheet-title" className="mt-5 flex items-baseline gap-2">
          <span className="text-[24px] font-bold">📍 {pin.city}</span>
          <span className="text-[13px] text-sub">
            기록 {pin.recordCount}개 · 모임방 {pin.rooms.length}개
          </span>
        </h2>

        {pin.summary && (
          <section className="mt-4 rounded-[20px] bg-[#fbe9f0] px-4 py-4">
            <p className="text-[12px] font-semibold text-point">
              ✦ AI가 기억하는 {pin.city}
            </p>
            <p className="mt-2 text-[16px] leading-7 font-bold">
              “{pin.summary}”
            </p>
          </section>
        )}

        {/* 이 도시에서 찍은 사진마다: 장소·방·사진, 그리고 덧붙이기(진행 중) 또는 답가(완성)로 바로 간다 */}
        {pin.places.length > 0 && (
          <section className="mt-6">
            <h3 className="text-[13px] font-semibold text-sub">
              {pin.city}에서 찍은 사진
            </h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {pin.places.map((place) => {
                const room = pin.rooms.find((r) => r.roomId === place.roomId);
                return (
                  <li key={place.photoId}>
                    <PlacePhotoCard
                      place={place}
                      roomName={room?.name ?? "모임방"}
                      completed={room?.status === "GROWING"}
                      card={photoCards[place.photoId]}
                      onGo={(path) => navigate(path)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

const ALL_ROOMS = "all";

/** 고른 방의 사진 장소만 남긴 도시 핀. 전체면 그대로 */
function filterPins(pins: CityPin[], roomId: string): CityPin[] {
  if (roomId === ALL_ROOMS) return pins;
  return pins
    .map((pin) => {
      const rooms = pin.rooms.filter((r) => r.roomId === roomId);
      const places = pin.places.filter((p) => p.roomId === roomId);
      return {
        ...pin,
        rooms,
        places,
        photoCount: places.length,
        recordCount: rooms.reduce((sum, r) => sum + r.recordCount, 0),
        bloomed: rooms.some((r) => r.scrollReady),
        summary: rooms.find((r) => r.summary)?.summary ?? null,
      };
    })
    .filter((pin) => pin.places.length > 0 || pin.rooms.length > 0);
}

/** 지도 위 방 고르기: 펼치면 내 방들과 전체 모임방 */
function RoomFilter({
  rooms,
  value,
  onChange,
}: {
  rooms: { roomId: string; name: string }[];
  value: string;
  onChange: (roomId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    value === ALL_ROOMS
      ? "전체 모임방"
      : (rooms.find((r) => r.roomId === value)?.name ?? "전체 모임방");
  const options = [{ roomId: ALL_ROOMS, name: "전체 모임방" }, ...rooms];
  return (
    <div className="relative mt-2.5 inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold shadow-[0_2px_10px_rgba(42,38,35,0.06)]"
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`text-sub transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1.5 max-h-64 min-w-[180px] overflow-y-auto rounded-[16px] border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgba(42,38,35,0.12)]"
        >
          {options.map((o) => (
            <li key={o.roomId} role="option" aria-selected={o.roomId === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.roomId);
                  setOpen(false);
                }}
                className={`w-full truncate rounded-[12px] px-3 py-2 text-left text-[13px] ${
                  o.roomId === value
                    ? "bg-point/15 font-semibold text-point"
                    : ""
                }`}
              >
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 아래 탭 "기록 지도": 내 사진 장소를 도시별 꽃 핀으로 보여준다. 방을 고르면 그 방 사진의 장소만 보인다 */
function RecordMapPage() {
  const [allPins, setPins] = useState<CityPin[] | null>(null);
  const [error, setError] = useState(false);
  const [openCity, setOpenCity] = useState<CityPin | null>(null);
  const [roomId, setRoomId] = useState(ALL_ROOMS);
  const pins = allPins ? filterPins(allPins, roomId) : null;
  // 지도에 장소가 있는 방들 (방 고르기 목록)
  const roomOptions = allPins
    ? [
        ...new Map(
          allPins
            .flatMap((p) => p.rooms)
            .map((r) => [r.roomId, { roomId: r.roomId, name: r.name }]),
        ).values(),
      ]
    : [];

  useEffect(() => {
    getMyRecordMap()
      .then(setPins)
      .catch(() => setError(true));
  }, []);

  return (
    <main
      className={`relative flex min-h-dvh flex-col bg-[#e9eeec] text-ink ${BOTTOM_TABS_SPACE}`}
    >
      <header className="px-5 pt-[clamp(40px,8dvh,64px)]">
        <p className="inline-flex items-baseline gap-2 rounded-full bg-surface px-5 py-3 shadow-[0_2px_10px_rgba(42,38,35,0.06)]">
          <span className="text-[18px] font-bold">우리 기록 지도</span>
          <span className="text-[12px] text-sub">
            대구·경북 {pins?.length ?? 0}곳
          </span>
        </p>
        <div>
          <RoomFilter
            rooms={roomOptions}
            value={roomId}
            onChange={(next) => {
              setRoomId(next);
              setOpenCity(null);
            }}
          />
        </div>
      </header>

      <div className="relative mx-5 mt-6 aspect-[4/5] flex-1">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          <path
            d={LAND_PATH}
            fill="#f3eee4"
            stroke="#ddd5c8"
            strokeWidth="0.4"
          />
        </svg>
        <span
          className="absolute top-[38%] right-0 text-[11px] text-[#9fb3b0]"
          aria-hidden="true"
        >
          동해
        </span>

        {pins?.map((pin) => {
          const { x, y } = project(pin.latitude, pin.longitude);
          const active = openCity?.city === pin.city;
          return (
            <button
              key={pin.city}
              type="button"
              onClick={() => setOpenCity(pin)}
              aria-label={`${pin.city} 기록 ${pin.recordCount}개`}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
            >
              <span
                className={`flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2 text-[14px] font-bold shadow-[0_3px_12px_rgba(42,38,35,0.12)] ${
                  active ? "bg-ink text-surface" : "bg-surface"
                }`}
              >
                <Flower code={cityFlower(pin.city)} size={20} />
                {pin.city}
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] ${
                    pin.bloomed
                      ? "bg-point text-surface"
                      : "bg-ink text-surface"
                  }`}
                >
                  {pin.recordCount}
                </span>
              </span>
              <span className="h-3 w-0.5 bg-ink" aria-hidden="true" />
            </button>
          );
        })}

        {pins?.length === 0 && (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[13px] leading-6 text-sub">
            아직 지도에 핀 꽃이 없어요.
            <br />
            사진에 장소를 남기면 여기에 꽃이 피어요
          </p>
        )}
        {error && (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[13px] text-sub">
            지도를 불러오지 못했어요. 잠시 후 다시 열어 주세요
          </p>
        )}
      </div>

      <p className="mx-5 mt-4 mb-4 rounded-[18px] bg-surface px-5 py-3.5 text-[13px] text-sub">
        도시를 누르면 AI가 그곳의 추억을 한 줄로 들려줘요
      </p>

      {openCity && (
        <CitySheet pin={openCity} onClose={() => setOpenCity(null)} />
      )}
      <BottomTabs />
    </main>
  );
}

export default RecordMapPage;
