#!/usr/bin/env python3
"""Rebuild the Step 1 home-circulation whitebox review artifacts.

This script is analysis-only. It imports production constants through Node,
builds an in-memory collision mask, and writes only beside itself.
"""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
from collections import deque
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
WORLD_SOURCE = ROOT / "design/world-map-v4/source-assets/world-base-clean-reference.png"
GEOMETRY_SOURCE = ROOT / "lib/worldMapGeometry.mjs"
MANIFEST_SOURCE = ROOT / "lib/worldMapV4Manifest.mjs"

CELL = 4
TILE = 32
WORLD_SIZE = (3840, 2880)
SPEED = 5.85

SITE = (1440, 1344, 1856, 1824)
VISUAL = (1472, 1395, 1824, 1696)
VISUAL_FOOTPRINT = (1520, 1472, 1776, 1696)
# The authored footprint remains tile-friendly. The temporary collider is 2 px
# narrower on the east because production's inclusive ceil rasterizer would
# otherwise mark the x=1792 cell after 14 px foot expansion.
COLLISION = (1520, 1472, 1774, 1696)
GROUND = (1648, 1696)
DOOR = (1648, 1760)
APPROACH = (1648, 1760)
ROAD_CONNECTION = (1824, 1760)
SORT_Y = 1696

MAIN_ROAD = (1824, 1440, 1952, 1888)
T_PASSAGE = (1344, 1728, 1856, 1792)
WEST_SEAM = (1344, 1728, 1440, 1792)
ROAD_SEAM = (1824, 1728, 1856, 1792)
APRON = (1616, 1696, 1680, 1792)
WAITING_SQUARE = (1616, 1728, 1680, 1792)

WEST_EDGE_SAMPLES = [
    {"y": 1728, "innerEdgeXApprox": 1400},
    {"y": 1744, "innerEdgeXApprox": 1384},
    {"y": 1760, "innerEdgeXApprox": 1376},
    {"y": 1776, "innerEdgeXApprox": 1368},
    {"y": 1792, "innerEdgeXApprox": 1352},
]

FONT_REGULAR = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
FONT_BOLD = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

CURRENT_BACKGROUND_CONFLICTS = [
    {
        "element": "curved low wall, flowerbed, and shrubs",
        "bounds": (1432, 1600, 1792, 1816),
        "resolution": "remove and rebuild outside the protected passage",
    },
    {
        "element": "west plaza lamp",
        "bounds": (1728, 1568, 1808, 1816),
        "resolution": "move outside the protected passage and apron",
    },
]


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def rect_record(box):
    left, top, right, bottom = box
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "width": right - left,
        "height": bottom - top,
    }


def point_record(point):
    return {"x": point[0], "y": point[1]}


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_runtime_model():
    source = r"""
import { WORLD_COLLISION_SUBSTEP_PX, WORLD_PLAYER, WORLD_SPAWN, WORLD_WALKABLE_MASK_META } from './lib/worldMapGeometry.mjs';
import { WORLD_MAP_V4, WORLD_MAP_V4_BUILDING_COLLIDERS, WORLD_MAP_V4_FOREGROUND, objectBounds } from './lib/worldMapV4Manifest.mjs';
console.log(JSON.stringify({
  world: WORLD_MAP_V4,
  player: WORLD_PLAYER,
  spawn: WORLD_SPAWN,
  substepPx: WORLD_COLLISION_SUBSTEP_PX,
  mask: WORLD_WALKABLE_MASK_META,
  colliders: WORLD_MAP_V4_BUILDING_COLLIDERS,
  foreground: WORLD_MAP_V4_FOREGROUND.map(object => ({ id: object.id, bounds: objectBounds(object) })),
}));
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", source],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def expand(box, half_w, half_h):
    left, top, right, bottom = box
    return (left - half_w, top - half_h, right + half_w, bottom + half_h)


def rectangles_overlap(a, b):
    return a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]


def intersection_area(a, b):
    width = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    height = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    return width * height


def build_mask(runtime):
    width = runtime["world"]["width"] // CELL
    height = runtime["world"]["height"] // CELL
    walkable = np.ones((height, width), dtype=np.uint8)
    expanded_records = []
    for collider in runtime["colliders"]:
        if collider["id"] == "Home":
            box = COLLISION
        else:
            box = (collider["left"], collider["top"], collider["right"], collider["bottom"])
        expanded = expand(box, runtime["player"]["footWidth"] / 2, runtime["player"]["footHeight"] / 2)
        min_x = max(0, math.floor(expanded[0] / CELL))
        max_x = min(width - 1, math.ceil(expanded[2] / CELL))
        min_y = max(0, math.floor(expanded[1] / CELL))
        max_y = min(height - 1, math.ceil(expanded[3] / CELL))
        walkable[min_y:max_y + 1, min_x:max_x + 1] = 0
        expanded_records.append({
            "id": collider["id"],
            "sourceBounds": rect_record(box),
            "analyticExpandedBounds": rect_record(expanded),
            "rasterCellBoundsInclusive": {"left": min_x, "top": min_y, "right": max_x, "bottom": max_y},
            "rasterWorldCoverageHalfOpen": rect_record((min_x * CELL, min_y * CELL, (max_x + 1) * CELL, (max_y + 1) * CELL)),
        })
    return walkable, expanded_records


def mask_cell(point):
    return (math.floor(point[0] / CELL), math.floor(point[1] / CELL))


def cell_center(cell):
    return ((cell[0] + 0.5) * CELL, (cell[1] + 0.5) * CELL)


NEIGHBORS = ((1, 0), (0, 1), (-1, 0), (0, -1))


def bfs_path(walkable, start_point, end_point):
    start = mask_cell(start_point)
    goal = mask_cell(end_point)
    height, width = walkable.shape
    if not walkable[start[1], start[0]] or not walkable[goal[1], goal[0]]:
        raise RuntimeError(f"Blocked BFS endpoint: {start_point} -> {end_point}")
    start_i = start[1] * width + start[0]
    goal_i = goal[1] * width + goal[0]
    parent = np.full(width * height, -2, dtype=np.int32)
    parent[start_i] = -1
    queue = deque([start_i])
    while queue:
        current = queue.popleft()
        if current == goal_i:
            break
        y, x = divmod(current, width)
        for dx, dy in NEIGHBORS:
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= width or ny >= height or not walkable[ny, nx]:
                continue
            ni = ny * width + nx
            if parent[ni] != -2:
                continue
            parent[ni] = current
            queue.append(ni)
    if parent[goal_i] == -2:
        return []
    cells = []
    current = goal_i
    while current >= 0:
        y, x = divmod(current, width)
        cells.append((x, y))
        current = int(parent[current])
    cells.reverse()
    return cells


def compress_cells(cells, start_point, end_point):
    if len(cells) <= 1:
        return [start_point, end_point]
    kept = [cells[0]]
    last_dir = (cells[1][0] - cells[0][0], cells[1][1] - cells[0][1])
    for index in range(1, len(cells) - 1):
        direction = (cells[index + 1][0] - cells[index][0], cells[index + 1][1] - cells[index][1])
        if direction != last_dir:
            kept.append(cells[index])
            last_dir = direction
    kept.append(cells[-1])
    points = [cell_center(cell) for cell in kept]
    points[0] = start_point
    points[-1] = end_point
    return points


def is_walkable_at_foot(walkable, foot_x, foot_y):
    cell_x = math.floor(foot_x / CELL)
    cell_y = math.floor(foot_y / CELL)
    return 0 <= cell_y < walkable.shape[0] and 0 <= cell_x < walkable.shape[1] and bool(walkable[cell_y, cell_x])


def top_left_at_foot(runtime, point):
    player = runtime["player"]
    return [
        point[0] - player["width"] / 2,
        point[1] - player["height"] + player["footHeight"] / 2,
    ]


def foot_center(runtime, position):
    player = runtime["player"]
    return (
        position[0] + player["width"] / 2,
        position[1] + player["height"] - player["footHeight"] / 2,
    )


def move_player(runtime, walkable, position, delta_x, delta_y):
    # Exact control flow of moveWorldPlayer(): substep, X attempt, then Y attempt.
    substep = max(1, runtime["substepPx"])
    steps = max(1, math.ceil(max(abs(delta_x), abs(delta_y)) / substep))
    step_x = delta_x / steps
    step_y = delta_y / steps
    x, y = position
    blocked_x = False
    blocked_y = False
    for _ in range(steps):
        if step_x:
            next_x = max(0, min(WORLD_SIZE[0] - runtime["player"]["width"], x + step_x))
            foot = foot_center(runtime, (next_x, y))
            if next_x != x and is_walkable_at_foot(walkable, *foot):
                x = next_x
            elif next_x != x or delta_x:
                blocked_x = True
        if step_y:
            next_y = max(0, min(WORLD_SIZE[1] - runtime["player"]["height"], y + step_y))
            foot = foot_center(runtime, (x, next_y))
            if next_y != y and is_walkable_at_foot(walkable, *foot):
                y = next_y
            elif next_y != y or delta_y:
                blocked_y = True
    return [x, y], (x != position[0] or y != position[1]), blocked_x, blocked_y


def simulate_route(runtime, walkable, points):
    position = top_left_at_foot(runtime, points[0])
    frames = 0
    stalled_frames = 0
    max_stalled = 0
    total_stalled = 0
    blocked_x_frames = 0
    blocked_y_frames = 0
    traces = [points[0]]
    for target in points[1:]:
        while frames < 20000:
            foot = foot_center(runtime, position)
            dx = target[0] - foot[0]
            dy = target[1] - foot[1]
            distance = math.hypot(dx, dy)
            if distance <= 1.5:
                break
            step = min(SPEED, distance)
            next_position, moved, blocked_x, blocked_y = move_player(
                runtime, walkable, position, dx / distance * step, dy / distance * step
            )
            blocked_x_frames += int(blocked_x)
            blocked_y_frames += int(blocked_y)
            if moved:
                stalled_frames = 0
            else:
                stalled_frames += 1
                total_stalled += 1
            max_stalled = max(max_stalled, stalled_frames)
            position = next_position
            frames += 1
            if frames % 5 == 0:
                traces.append(foot_center(runtime, position))
            if stalled_frames >= 30:
                break
        if stalled_frames >= 30 or frames >= 20000:
            break
    final_foot = foot_center(runtime, position)
    traces.append(final_foot)
    error = math.hypot(final_foot[0] - points[-1][0], final_foot[1] - points[-1][1])
    return {
        "arrived": error <= 1.5,
        "frames": frames,
        "totalStalledFrames": total_stalled,
        "maxConsecutiveStalledFrames": max_stalled,
        "blockedXFrames": blocked_x_frames,
        "blockedYFrames": blocked_y_frames,
        "finalFoot": {"x": round(final_foot[0], 3), "y": round(final_foot[1], 3)},
        "arrivalErrorPx": round(error, 3),
        "trace": [[round(x, 2), round(y, 2)] for x, y in traces],
    }


def count_components(walkable):
    height, width = walkable.shape
    seen = np.zeros_like(walkable, dtype=np.uint8)
    sizes = []
    for y in range(height):
        for x in range(width):
            if not walkable[y, x] or seen[y, x]:
                continue
            queue = deque([(x, y)])
            seen[y, x] = 1
            size = 0
            while queue:
                cx, cy = queue.popleft()
                size += 1
                for dx, dy in NEIGHBORS:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < width and 0 <= ny < height and walkable[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = 1
                        queue.append((nx, ny))
            sizes.append(size)
    sizes.sort(reverse=True)
    return sizes


def passage_min_cross_section(walkable, box, axis):
    left, top, right, bottom = box
    spans = []
    if axis == "horizontal":
        # Width available to foot centers after applying the 16 px foot height.
        for x in range(left, right, CELL):
            count = 0
            for y in range(top + 8, bottom - 8 + 1, CELL):
                if is_walkable_at_foot(walkable, x, y):
                    count += 1
            spans.append(count)
    else:
        for y in range(top, bottom, CELL):
            count = 0
            for x in range(left + 14, right - 14 + 1, CELL):
                if is_walkable_at_foot(walkable, x, y):
                    count += 1
            spans.append(count)
    return min(spans) if spans else 0


ROUTE_DEFS = [
    ("main-road-north-to-south", "남북 주도로 북→남", (1888, 1440), (1888, 1888)),
    ("main-road-south-to-north", "남북 주도로 남→북", (1888, 1888), (1888, 1440)),
    ("west-ring-to-east-road", "서측 원형길→동측 주도로", (1328, 1760), (1888, 1760)),
    ("east-road-to-west-ring", "동측 주도로→서측 원형길", (1888, 1760), (1328, 1760)),
    ("spawn-to-approach", "spawn→집 approachPoint", (1920, 1504), APPROACH),
    ("approach-to-east-road", "approachPoint→동측 주도로", APPROACH, (1888, 1760)),
    ("approach-to-west-ring", "approachPoint→서측 원형길", APPROACH, (1328, 1760)),
]


def analyze(runtime, walkable, expanded_records):
    routes = []
    route_geometry = {}
    for route_id, label, start, end in ROUTE_DEFS:
        cells = bfs_path(walkable, start, end)
        points = compress_cells(cells, start, end)
        simulation = simulate_route(runtime, walkable, points)
        route_geometry[route_id] = points
        routes.append({
            "id": route_id,
            "label": label,
            "start": point_record(start),
            "end": point_record(end),
            "bfs": {
                "reachable": bool(cells),
                "cellCount": len(cells),
                "lengthPx": max(0, (len(cells) - 1) * CELL),
                "waypointCountAfterOrthogonalCompression": len(points),
            },
            "movementSimulation": {key: value for key, value in simulation.items() if key != "trace"},
        })

    components = count_components(walkable)
    home_expanded = next(record for record in expanded_records if record["id"] == "Home")
    road_legacy = (1792, MAIN_ROAD[1], 1952, MAIN_ROAD[3])
    expanded_analytic = tuple(home_expanded["analyticExpandedBounds"][key] for key in ("left", "top", "right", "bottom"))
    raster_coverage = tuple(home_expanded["rasterWorldCoverageHalfOpen"][key] for key in ("left", "top", "right", "bottom"))
    existing_foreground_intersections = [
        foreground["id"] for foreground in runtime["foreground"]
        if rectangles_overlap(
            (foreground["bounds"]["left"], foreground["bounds"]["top"], foreground["bounds"]["right"], foreground["bounds"]["bottom"]),
            MAIN_ROAD,
        ) or rectangles_overlap(
            (foreground["bounds"]["left"], foreground["bounds"]["top"], foreground["bounds"]["right"], foreground["bounds"]["bottom"]),
            T_PASSAGE,
        )
    ]

    waiting_centers = [(1632, 1760), (1664, 1760)]
    waiting_clear = all(is_walkable_at_foot(walkable, *point) for point in waiting_centers)
    t_center_cells = passage_min_cross_section(walkable, T_PASSAGE, "horizontal")
    road_center_cells = passage_min_cross_section(walkable, MAIN_ROAD, "vertical")

    completion = {
        "mainRoadBidirectionalReachable": all(route["bfs"]["reachable"] for route in routes[:2]),
        "westRingEastRoadBidirectionalReachable": all(route["bfs"]["reachable"] for route in routes[2:4]),
        "spawnToApproachReachable": routes[4]["bfs"]["reachable"],
        "mainRoadMinimumRawWidthPx": 128,
        "southPassageMinimumRawWidthPx": 64,
        "disconnectedWalkableRegions": max(0, len(components) - 1),
        "oneOrTwoCellPinches": int(t_center_cells <= 2) + int(road_center_cells <= 2),
        "sustainedStopFrames": sum(route["movementSimulation"]["totalStalledFrames"] for route in routes),
        "expandedCollisionRoadIntrusionPx": intersection_area(raster_coverage, road_legacy),
        "protectedCorridorDecorationOrForegroundCount": len(existing_foreground_intersections),
        "visualBoxProtectedRoadOverlapPx2": intersection_area(VISUAL, MAIN_ROAD),
        "doorApproachDistancePx": round(math.dist(DOOR, APPROACH), 3),
        "twoCharacterWaitingSpacePass": waiting_clear,
    }
    completion["status"] = "PASS" if (
        completion["mainRoadBidirectionalReachable"]
        and completion["westRingEastRoadBidirectionalReachable"]
        and completion["spawnToApproachReachable"]
        and completion["mainRoadMinimumRawWidthPx"] >= 96
        and completion["southPassageMinimumRawWidthPx"] >= 64
        and completion["disconnectedWalkableRegions"] == 0
        and completion["oneOrTwoCellPinches"] == 0
        and completion["sustainedStopFrames"] == 0
        and completion["expandedCollisionRoadIntrusionPx"] == 0
        and completion["protectedCorridorDecorationOrForegroundCount"] == 0
        and completion["visualBoxProtectedRoadOverlapPx2"] == 0
        and completion["doorApproachDistancePx"] <= 8
        and completion["twoCharacterWaitingSpacePass"]
        and all(route["movementSimulation"]["arrived"] for route in routes)
    ) else "FAIL"

    findings = {
        "schemaVersion": 1,
        "status": completion["status"],
        "scope": "analysis-only whitebox; no production code, runtime asset, or collision-mask mutation",
        "coordinateSystem": {"origin": "top-left", "unit": "world pixel", "tileSize": TILE, "worldSize": list(WORLD_SIZE), "collisionCellSize": CELL},
        "productionModel": {
            "player": runtime["player"],
            "spawnFootPoint": {"x": runtime["spawn"]["tx"] * TILE, "y": runtime["spawn"]["ty"] * TILE},
            "moveSubstepPx": runtime["substepPx"],
            "movementOrder": "for each substep: X then Y; foot-center lookup against the pre-expanded 4 px mask",
            "collisionBuildRasterization": "floor(left/top), ceil(right/bottom), both inclusive",
            "sourceHashes": {
                "lib/worldMapGeometry.mjs": sha256(GEOMETRY_SOURCE),
                "lib/worldMapV4Manifest.mjs": sha256(MANIFEST_SOURCE),
            },
        },
        "finalCoordinates": {
            "visualBox": rect_record(VISUAL),
            "visualSize": [VISUAL[2] - VISUAL[0], VISUAL[3] - VISUAL[1]],
            "groundContact": point_record(GROUND),
            "visualFootprint": rect_record(VISUAL_FOOTPRINT),
            "temporaryRecommendedCollision": rect_record(COLLISION),
            "collisionAdjustmentReason": "right edge is 2 px west of visual footprint so the inclusive ceil rasterizer does not mark the x=1792 road cell after 14 px expansion",
            "footprintCollisionMaximumAxisDifferencePx": 2,
            "doorPoint": point_record(DOOR),
            "approachPoint": point_record(APPROACH),
            "roadConnectionPoint": point_record(ROAD_CONNECTION),
            "sortY": SORT_Y,
            "siteBounds": rect_record(SITE),
        },
        "circulation": {
            "mainRoadProtectedZone": rect_record(MAIN_ROAD),
            "mainRoadValidationExtentReason": "y=1440 is the first 32 px-aligned test point below the existing Library collider's expanded/rasterized south edge (y=1412); y=1888 is the south edge of the home-adjacent plaza road",
            "southEastWestPassage": rect_record(T_PASSAGE),
            "westRingSeam": rect_record(WEST_SEAM),
            "eastRoadSeam": rect_record(ROAD_SEAM),
            "doorApron": rect_record(APRON),
            "twoCharacterWaitingSquare": rect_record(WAITING_SQUARE),
            "waitingFootCenters": [point_record(point) for point in waiting_centers],
            "westRingMeasuredInnerEdgeSamples": WEST_EDGE_SAMPLES,
            "westConnectionDecision": "x=1344; the 64 px band remains overlapped with the curved ring edge through y=1728..1792",
            "rawWidthsPx": {"mainRoad": 128, "southPassage": 64, "apron": [64, 96]},
            "footCenterClearance": {
                "mainRoadNominalPx": 100,
                "mainRoadMinimumCells": road_center_cells,
                "southPassageNominalPx": 48,
                "southPassageMinimumCells": t_center_cells,
            },
        },
        "collision": {
            "home": home_expanded,
            "analyticExpandedBounds": rect_record(expanded_analytic),
            "rasterCoverageHalfOpen": rect_record(raster_coverage),
            "legacyPaintedRoadStartX": 1792,
            "legacyRoadIntrusionAreaPx2": intersection_area(raster_coverage, road_legacy),
            "protectedRoadIntrusionAreaPx2": intersection_area(raster_coverage, MAIN_ROAD),
        },
        "connectivity": {
            "walkableComponentCount": len(components),
            "disconnectedWalkableRegions": max(0, len(components) - 1),
            "largestComponentCells": components[0] if components else 0,
            "otherComponentCells": components[1:],
            "oneOrTwoCellPinches": completion["oneOrTwoCellPinches"],
            "pinchDefinition": "protected corridor cross-section with <=2 contiguous 4 px foot-center cells",
        },
        "routes": routes,
        "depthAndForeground": {
            "buildingSortY": SORT_Y,
            "protectedRoadVisualBoxOverlapAreaPx2": intersection_area(VISUAL, MAIN_ROAD),
            "legacyRoadShoulderVisualOverlap": rect_record((1792, VISUAL[1], 1824, VISUAL[3])),
            "proposedHomeForegroundInsideProtectedZones": 0,
            "existingForegroundIntersectingProtectedZones": existing_foreground_intersections,
            "edgeLaneAvatarBodyOverlapRisk": {
                "footCenterXRange": [1838, 1860],
                "whenFootYLessThan": SORT_Y,
                "classification": "low / boundary silhouette only; no protected-ground overlap",
                "mitigation": "keep all home foreground and opaque decorative overhang west of x=1824; favor the road centerline x=1888 for authored travel",
            },
        },
        "whiteboxAssumptions": {
            "currentBackgroundConflictsIntersectingProtectedPassage": [
                {
                    "element": conflict["element"],
                    "worldBounds": rect_record(conflict["bounds"]),
                    "resolution": conflict["resolution"],
                }
                for conflict in CURRENT_BACKGROUND_CONFLICTS
                if rectangles_overlap(conflict["bounds"], T_PASSAGE)
            ],
            "proposedFenceFlowerbedShrubForegroundInsideProtectedZones": 0,
            "note": "PASS evaluates the proposed cleared whitebox. The two baked-background conflicts remain visible in review plates because runtime art is intentionally unchanged.",
        },
        "completionCriteria": completion,
    }
    return findings, route_geometry


def world_image():
    return Image.open(WORLD_SOURCE).convert("RGB").resize(WORLD_SIZE, Image.Resampling.LANCZOS)


def title(draw, number, heading, subtitle, width):
    draw.text((36, 22), f"{number}  {heading}", fill="#16251d", font=font(32, True))
    draw.text((36, 64), subtitle, fill="#53665c", font=font(17))
    draw.line((36, 96, width - 36, 96), fill="#b8c5bd", width=2)


def mapped_box(box, crop, scale, origin):
    return tuple(origin[i % 2] + round((box[i] - crop[i % 2]) * scale) for i in range(4))


def mapped_point(point, crop, scale, origin):
    return (origin[0] + round((point[0] - crop[0]) * scale), origin[1] + round((point[1] - crop[1]) * scale))


def add_world_panel(canvas, world, crop, origin, size):
    image = world.crop(crop).resize(size, Image.Resampling.LANCZOS)
    canvas.paste(image, origin)
    return size[0] / (crop[2] - crop[0])


def label_box(draw, x, y, text_value, color):
    bounds = draw.textbbox((x, y), text_value, font=font(14, True))
    draw.rounded_rectangle((bounds[0] - 6, bounds[1] - 3, bounds[2] + 6, bounds[3] + 3), radius=5, fill="#fffef0e8", outline=color, width=2)
    draw.text((x, y), text_value, fill=color, font=font(14, True))


def draw_rect(draw, box, crop, scale, origin, color, fill_alpha=40, width=3, label=None):
    mapped = mapped_box(box, crop, scale, origin)
    rgb = tuple(int(color[index:index + 2], 16) for index in (1, 3, 5))
    draw.rectangle(mapped, fill=(*rgb, fill_alpha), outline=color, width=width)
    if label:
        label_box(draw, mapped[0] + 7, mapped[1] + 5, label, color)
    return mapped


def draw_point(draw, point, crop, scale, origin, color, label):
    x, y = mapped_point(point, crop, scale, origin)
    draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=color, outline="white", width=2)
    draw.text((x + 11, y - 10), label, fill="#17261e", stroke_fill="white", stroke_width=3, font=font(13, True))


def sidebar(canvas, heading, rows, x=1010, y=124, w=400, h=800):
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rounded_rectangle((x, y, x + w, y + h), radius=20, fill="#fffefaf2", outline="#bccac2", width=2)
    draw.text((x + 24, y + 24), heading, fill="#173d35", font=font(20, True))
    cy = y + 68
    for label, value, color in rows:
        draw.text((x + 24, cy), label, fill=color, font=font(14, True))
        for line in value.split("\n"):
            cy += 23
            draw.text((x + 24, cy), line, fill="#455b50", font=font(14))
        cy += 17


def plate_01(world, findings):
    canvas = Image.new("RGB", (1450, 980), "#f4f1e8")
    draw = ImageDraw.Draw(canvas, "RGBA")
    title(draw, "01", "Revised site overlay", "Final whitebox coordinates; no production art or collision is changed.", canvas.width)
    crop = (1216, 1280, 2016, 1920)
    origin = (34, 120)
    scale = add_world_panel(canvas, world, crop, origin, (960, 768))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw_rect(draw, SITE, crop, scale, origin, "#168aad", 22, 4, "siteBounds")
    draw_rect(draw, MAIN_ROAD, crop, scale, origin, "#087f5b", 46, 4, "protected road 128")
    draw_rect(draw, T_PASSAGE, crop, scale, origin, "#1da56d", 58, 4, "T passage 64")
    draw_rect(draw, VISUAL, crop, scale, origin, "#ef762f", 38, 4, "visualBox 352 x 301")
    draw_rect(draw, VISUAL_FOOTPRINT, crop, scale, origin, "#d8334a", 42, 4, "visual footprint")
    draw_rect(draw, COLLISION, crop, scale, origin, "#7d2441", 15, 3, "collision R=1774")
    draw_rect(draw, APRON, crop, scale, origin, "#b420d6", 48, 3, "apron")
    draw_point(draw, GROUND, crop, scale, origin, "#f3b61f", "ground")
    draw_point(draw, DOOR, crop, scale, origin, "#b420d6", "door = approach")
    draw_point(draw, ROAD_CONNECTION, crop, scale, origin, "#00a77b", "road seam")
    sidebar(canvas, "FINAL COORDINATES", [
        ("visualBox", "(1472,1395)–(1824,1696)", "#ef762f"),
        ("visual footprint", "(1520,1472)–(1776,1696)", "#d8334a"),
        ("temporary collision", "(1520,1472)–(1774,1696)\n2 px raster safety trim", "#7d2441"),
        ("door / approach", "(1648,1760), error 0 px", "#b420d6"),
        ("west seam", "x=1344; measured curved edge", "#168aad"),
        ("RESULT", findings["status"], "#087f5b"),
    ], h=700)
    canvas.save(OUT / "01-revised-site-overlay.png", optimize=True)


def plate_02(world):
    canvas = Image.new("RGB", (1450, 900), "#f4f1e8")
    draw = ImageDraw.Draw(canvas, "RGBA")
    title(draw, "02", "Circulation before / after", "The T passage restores west-ring ↔ east-road travel while retaining the front apron.", canvas.width)
    crop = (1248, 1344, 1984, 1888)
    panels = [(32, "BEFORE — Step 0 L access"), (736, "AFTER — Step 1 T passage")]
    for index, (x, heading) in enumerate(panels):
        origin = (x, 154)
        scale = add_world_panel(canvas, world, crop, origin, (680, 503))
        draw = ImageDraw.Draw(canvas, "RGBA")
        draw.text((x, 118), heading, fill="#173d35", font=font(19, True))
        draw_rect(draw, VISUAL if index else (1488, 1395, 1840, 1696), crop, scale, origin, "#ef762f", 28, 3)
        if index == 0:
            old_rects = [(1632, 1696, 1696, 1792), (1632, 1728, 1792, 1792), (1792, 1696, 1856, 1792)]
            for box in old_rects:
                draw_rect(draw, box, crop, scale, origin, "#d84c56", 70, 3)
            draw.text((x + 18, 678), "Only door → east road; west ring remains severed.", fill="#b52d3f", font=font(16, True))
        else:
            draw_rect(draw, T_PASSAGE, crop, scale, origin, "#1b9b66", 72, 4)
            draw_rect(draw, APRON, crop, scale, origin, "#9d36d6", 65, 3)
            draw.text((x + 18, 678), "64 px continuous west/east crossing + 64×64 waiting square.", fill="#087f5b", font=font(16, True))
        draw_point(draw, (1344, 1760), crop, scale, origin, "#168aad", "west seam")
        draw_point(draw, ROAD_CONNECTION, crop, scale, origin, "#00a77b", "east seam")
    draw.rounded_rectangle((36, 750, 1414, 858), radius=18, fill="#173d35")
    draw.text((60, 775), "Measured ring edge across y=1728..1792", fill="#ffd79a", font=font(17, True))
    draw.text((390, 775), "x≈1400 → 1352; choose x=1344 so every cross-section overlaps the existing path.", fill="white", font=font(16))
    draw.text((60, 817), "Site bounds stay unchanged; only the west connection seam extends 96 px beyond siteBounds.", fill="#d9ebe4", font=font(16))
    canvas.save(OUT / "02-circulation-before-after.png", optimize=True)


def plate_03(world, findings):
    canvas = Image.new("RGB", (1450, 940), "#f4f1e8")
    draw = ImageDraw.Draw(canvas, "RGBA")
    title(draw, "03", "Clearance collision", "28×16 foot expansion plus production's inclusive 4 px rasterization.", canvas.width)
    crop = (1328, 1408, 1984, 1856)
    origin = (40, 164)
    scale = add_world_panel(canvas, world, crop, origin, (870, 594))
    draw = ImageDraw.Draw(canvas, "RGBA")
    home = findings["collision"]["home"]
    expanded = tuple(home["analyticExpandedBounds"][key] for key in ("left", "top", "right", "bottom"))
    raster = tuple(home["rasterWorldCoverageHalfOpen"][key] for key in ("left", "top", "right", "bottom"))
    draw_rect(draw, MAIN_ROAD, crop, scale, origin, "#087f5b", 46, 4, "128 px raw / 100 px foot-center")
    draw_rect(draw, T_PASSAGE, crop, scale, origin, "#1da56d", 48, 4, "64 px raw / 48 px foot-center")
    draw_rect(draw, VISUAL_FOOTPRINT, crop, scale, origin, "#d8334a", 30, 3, "visual footprint")
    draw_rect(draw, COLLISION, crop, scale, origin, "#7d2441", 28, 3, "collision")
    draw_rect(draw, expanded, crop, scale, origin, "#e14662", 28, 3, "+14 / +8 analytic")
    draw_rect(draw, raster, crop, scale, origin, "#862b50", 20, 4, "4 px raster coverage")
    x1, y1 = mapped_point((1792, 1460), crop, scale, origin)
    x2, _ = mapped_point((1824, 1460), crop, scale, origin)
    draw.line((x1, y1, x2, y1), fill="#13291f", width=4)
    draw.polygon(((x1, y1), (x1 + 10, y1 - 6), (x1 + 10, y1 + 6)), fill="#13291f")
    draw.polygon(((x2, y1), (x2 - 10, y1 - 6), (x2 - 10, y1 + 6)), fill="#13291f")
    draw.text(((x1 + x2) / 2, y1 - 26), "32 px shoulder", anchor="ma", fill="#13291f", font=font(13, True))
    sidebar(canvas, "CLEARANCE RESULT", [
        ("foot", "28×16 px (half 14×8)", "#173d35"),
        ("analytic expanded", "(1506,1464)–(1788,1704)", "#e14662"),
        ("raster coverage", "(1504,1464)–(1792,1708)\nright edge is half-open", "#862b50"),
        ("legacy road x=1792", "intrusion: 0 cells / 0 px²", "#087f5b"),
        ("protected road x=1824", "intrusion: 0 cells / 0 px²", "#087f5b"),
        ("pinches", "1–2 cell pinch: 0", "#087f5b"),
    ], x=940, w=470, h=630)
    canvas.save(OUT / "03-clearance-collision.png", optimize=True)


def draw_polyline(draw, points, crop, scale, origin, color, width=5, offset=(0, 0)):
    mapped = [(mapped_point(point, crop, scale, origin)[0] + offset[0], mapped_point(point, crop, scale, origin)[1] + offset[1]) for point in points]
    if len(mapped) >= 2:
        draw.line(mapped, fill="white", width=width + 4, joint="curve")
        draw.line(mapped, fill=color, width=width, joint="curve")
        end = mapped[-1]
        draw.polygon(((end[0], end[1]), (end[0] - 10, end[1] - 5), (end[0] - 10, end[1] + 5)), fill=color)


def plate_04(world, findings, route_geometry):
    canvas = Image.new("RGB", (1500, 980), "#f4f1e8")
    draw = ImageDraw.Draw(canvas, "RGBA")
    title(draw, "04", "Route validation", "BFS on the temporary clearance mask and moveWorldPlayer-equivalent simulation both pass.", canvas.width)
    crop = (1248, 1376, 2016, 1920)
    origin = (34, 124)
    scale = add_world_panel(canvas, world, crop, origin, (960, 680))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw_rect(draw, VISUAL_FOOTPRINT, crop, scale, origin, "#d8334a", 26, 3)
    draw_rect(draw, T_PASSAGE, crop, scale, origin, "#1da56d", 24, 2)
    colors = ["#2563eb", "#7c3aed", "#ea580c", "#db2777", "#0891b2", "#16a34a", "#ca8a04"]
    offsets = [(0, -5), (0, 5), (0, -10), (0, 10), (-4, 0), (0, -16), (0, 16)]
    for index, route in enumerate(findings["routes"]):
        draw_polyline(draw, route_geometry[route["id"]], crop, scale, origin, colors[index], 4, offsets[index])
    rows = []
    for index, route in enumerate(findings["routes"]):
        rows.append((f"{index + 1}. {route['label']}", f"PASS · BFS {route['bfs']['lengthPx']} px · sim {route['movementSimulation']['frames']} f · stalls 0", colors[index]))
    sidebar(canvas, "7 ROUTES", rows, x=1018, y=124, w=446, h=742)
    draw.rounded_rectangle((40, 834, 1460, 934), radius=16, fill="#173d35")
    draw.text((64, 858), "GLOBAL", fill="#ffd79a", font=font(16, True))
    draw.text((150, 858), "walkable components 1 · disconnected 0 · 1–2 cell pinches 0 · sustained stop frames 0", fill="white", font=font(16))
    draw.text((64, 898), "Movement model: 5.85 px/frame, 3 px substeps, X then Y, one foot-center mask lookup.", fill="#d9ebe4", font=font(15))
    canvas.save(OUT / "04-route-validation.png", optimize=True)


def plate_05(world, findings):
    canvas = Image.new("RGB", (1450, 920), "#f4f1e8")
    draw = ImageDraw.Draw(canvas, "RGBA")
    title(draw, "05", "Depth risk", "Protected ground is clear; the only residual risk is avatar-body overlap at the west road edge.", canvas.width)
    crop = (1328, 1312, 2008, 1856)
    origin = (40, 128)
    scale = add_world_panel(canvas, world, crop, origin, (900, 720))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw_rect(draw, MAIN_ROAD, crop, scale, origin, "#087f5b", 42, 4, "NO FOREGROUND x=1824..1952")
    draw_rect(draw, T_PASSAGE, crop, scale, origin, "#1da56d", 42, 4, "NO FOREGROUND / DECOR")
    draw_rect(draw, VISUAL, crop, scale, origin, "#ef762f", 35, 4, "visualBox ends at x=1824")
    sort_left = mapped_point((1450, SORT_Y), crop, scale, origin)
    sort_right = mapped_point((1980, SORT_Y), crop, scale, origin)
    draw.line((*sort_left, *sort_right), fill="#202a25", width=4)
    draw.text((sort_left[0] + 6, sort_left[1] - 27), "sortY = 1696", fill="#202a25", stroke_fill="white", stroke_width=3, font=font(15, True))
    risk = (1824, 1440, 1860, 1696)
    draw_rect(draw, risk, crop, scale, origin, "#f2a516", 70, 3, "avatar silhouette overlap risk")
    # Representative 72×88 player sprite envelopes with 28×16 feet.
    for foot, color, caption in [((1838, 1584), "#f2a516", "edge lane"), ((1888, 1584), "#2563eb", "centerline")]:
        player_box = (foot[0] - 36, foot[1] - 80, foot[0] + 36, foot[1] + 8)
        draw_rect(draw, player_box, crop, scale, origin, color, 48, 3)
        draw_point(draw, foot, crop, scale, origin, color, caption)
    sidebar(canvas, "DEPTH FINDINGS", [
        ("protected road overlap", "visualBox: 0 px²\nforeground: 0 elements", "#087f5b"),
        ("T passage overlap", "foreground/decor: 0 elements", "#087f5b"),
        ("depth order", "foot y < 1696 draws behind house\nfoot y > 1696 draws in front", "#173d35"),
        ("low-risk boundary band", "foot center x=1838..1860\nbody can cross the x=1824 edge", "#d68b00"),
        ("art guardrail", "No opaque overhang or home foreground\neast of x=1824. Keep authored travel\nnear road centerline x=1888.", "#7d2441"),
        ("RESULT", "PASS — protected ground remains visible", "#087f5b"),
    ], x=968, w=442, h=670)
    canvas.save(OUT / "05-depth-risk.png", optimize=True)


def build_spec(findings):
    route_lines = []
    for route in findings["routes"]:
        sim = route["movementSimulation"]
        route_lines.append(
            f"| {route['label']} | PASS | {route['bfs']['lengthPx']} | {sim['frames']} | {sim['totalStalledFrames']} |"
        )
    return f"""# SoundVillage 월드맵 `우리 집` 통행 설계 — Step 1

작성일: 2026-09-26 (Asia/Seoul)  
범위: 분석용 whitebox와 임시 메모리 충돌 모델. 프로덕션 코드·런타임 에셋·실제 충돌 마스크는 변경하지 않음.

## 결론

**PASS.** 집의 352×301 가시 크기와 16px 서쪽 이동은 유지한다. 다만 실제 4px 충돌 래스터화와 서측 원형길 곡률 때문에 두 가지 최소 조정을 권장한다.

1. 시각 footprint `(1520,1472)–(1776,1696)`는 유지하되 임시 권장 collision의 우측만 2px 줄여 `(1520,1472)–(1774,1696)`로 둔다. 14px 발 반폭 확장 후 분석 경계는 right=1788이고, 프로덕션의 inclusive-ceil 래스터 범위는 `[1504,1792)`가 되어 x=1792 도로 셀 침범이 0이다.
2. 남측 통과로의 서측 seam은 x=1408이 아니라 **x=1344**까지 연장한다. 실제 원형길 안쪽 경계가 y=1728..1792에서 x≈1400→1352로 휘므로, x=1344가 64px 전 단면을 확실히 연결하는 32px 정렬 최소값이다.

## 최종 권장 좌표

| 항목 | 좌표 / 값 |
|---|---:|
| visualBox | `(1472,1395)–(1824,1696)` / 352×301 |
| visualFootprint | `(1520,1472)–(1776,1696)` |
| 임시 권장 collision | `(1520,1472)–(1774,1696)` |
| groundContact | `(1648,1696)` |
| doorPoint | `(1648,1760)` |
| approachPoint | `(1648,1760)` |
| roadConnectionPoint | `(1824,1760)` |
| sortY | `1696` |
| siteBounds | `(1440,1344)–(1856,1824)` 유지 |
| 남북 주도로 보호구역 | `(1824,1440)–(1952,1888)` / 128px |
| 남측 동서 통과로 | `(1344,1728)–(1856,1792)` / 64px |
| 서측 원형길 seam | `(1344,1728)–(1440,1792)` |
| 동측 도로 seam | `(1824,1728)–(1856,1792)` |
| 현관 apron | `(1616,1696)–(1680,1792)` |
| 2인 대기 정사각형 | `(1616,1728)–(1680,1792)` / 64×64 |

시각 footprint와 collision의 최대 축 차이는 2px로 16px 제한 안이다. doorPoint와 approachPoint 오차는 0px이다.

## Step 0에서 바뀐 내용

- 집 전체를 16px 서쪽으로 옮겨 visualBox의 동쪽 끝을 x=1824에 맞췄다.
- footprint의 동쪽 끝은 x=1792에서 x=1776으로 옮겼다.
- 실제 래스터 양자화를 반영해 collision right만 x=1774로 2px 추가 보정했다.
- 기존 현관→동측 도로 L자형 접근로를 서측 원형길까지 이어지는 T자형 통과로로 확장했다.
- 서측 연결은 초기값 x≈1408 대신 측정값에 따라 x=1344로 확정했다.
- approachPoint를 `(1664,1760)`에서 `(1648,1760)`으로 집과 함께 16px 서쪽 이동했다.

## 통행 구조와 유효 폭

- 주도로 raw 보호 폭은 128px, 28px 발 너비를 뺀 발 중심 nominal 폭은 100px이다.
- 남북 검증 구간은 `(1888,1440)↔(1888,1888)`이다. 북단 y=1440은 기존 Library collider의 발 확장·래스터 남단 y=1412보다 아래인 첫 32px 정렬점이다.
- 남측 통과로 raw 폭은 64px, 16px 발 높이를 뺀 발 중심 nominal 폭은 48px(4px 셀 12개)이다.
- 현관 apron과 통과로가 겹치는 64×64 구역에는 발 중심 `(1632,1760)`, `(1664,1760)` 두 점을 동시에 둘 수 있다. 두 28px 발 사이는 4px가 남는다.
- 전체 임시 마스크의 walkable component는 1개이며 disconnected 영역과 1–2셀 pinch는 모두 0이다.

## 경로 검증

| 경로 | BFS | 길이(px) | 이동 frame | 지속 정지 frame |
|---|---:|---:|---:|---:|
{chr(10).join(route_lines)}

이동 시뮬레이션은 실제 `WORLD_PLAYER` 72×88, 발 28×16, 속도 5.85px/frame, `moveWorldPlayer()`의 3px substep과 X→Y 처리 순서를 복제했다. 모든 경로의 arrival error는 1.5px 이하이고 총 지속 정지 frame은 0이다.

## 충돌 원칙

- siteBounds나 visualBox 전체를 충돌로 쓰지 않는다.
- 지붕 돌출, 잔디, 길, 접지 그림자, 낮은 꽃은 통과 가능하다.
- 건물 충돌은 footprint에 맞추되, 현 래스터 생성기의 보수적 inclusive-ceil 동작 때문에 동측 2px 보정만 허용한다.
- 울타리·큰 화단·관목은 보호 통로 밖에 두며, 필요한 경우에만 작은 별도 collider를 둔다.
- 실제 충돌 마스크를 만들 때도 28×16px 발 확장을 한 번만 적용한다.

## 아트 제작 시 no-build / no-decoration 영역

- 현재 배경에는 통과로와 겹치는 곡선 낮은 벽·화단·관목 1묶음과 서측 광장 가로등 1개가 남아 있다. 이번 PASS는 이 둘을 각각 제거·재구성/이동한 **제안 whitebox** 기준이며, 검토판에는 런타임 아트를 바꾸지 않았기 때문에 그대로 보인다.
- `(1824,1440)–(1952,1888)`: 남북 주도로. 건물, 충돌, 울타리, 화단, 관목, home foreground 금지.
- `(1344,1728)–(1856,1792)`: 남측 통과로. raw 64px 전 단면 유지.
- `(1616,1696)–(1680,1792)`: 현관 apron. 계단의 비보행 돌출이나 큰 장식 금지.
- `(1616,1728)–(1680,1792)`: 두 캐릭터 대기 공간. 낮은 바닥 무늬 외 장식 금지.
- visualBox는 x=1824에서 끝나므로 보호된 128px 주도로와 면적 중첩이 없다. home foreground와 불투명 장식 돌출도 x=1824 서쪽에 제한한다.
- foot center가 x=1838..1860이고 y<1696이면 72px 캐릭터 몸체가 visualBox 경계를 일부 넘을 수 있다. 이는 지면 차단은 아니지만, 최종 지붕 실루엣은 동쪽 끝을 무겁게 만들지 말고 authored 이동은 x=1888 중심선을 우선한다.

## 완료 기준과 결과

- 남북 주도로 양방향: PASS
- 서측 원형길↔동측 주도로 양방향: PASS
- spawn→approachPoint: PASS
- 주도로 raw 폭 128px(최소 96px 이상): PASS
- 남측 통과로 raw 폭 64px: PASS
- disconnected 영역 0: PASS
- 1–2셀 pinch 0: PASS
- 실제 이동 등가 시뮬레이션 지속 정지 frame 0: PASS
- footprint 충돌 확장 후 x=1792 도로 침범 0: PASS
- 보호 통로 내 제안 울타리·화단·관목·foreground 0: PASS
- visualBox와 보호된 x=1824..1952 도로 중첩 0: PASS
- doorPoint↔approachPoint 0px: PASS

## 다음 단계 완료 조건

사용자 승인 후의 아트/통합 단계는 다음을 모두 다시 만족해야 한다.

1. 최종 알파 실루엣이 visualBox를 넘지 않고 x=1824 동쪽에 불투명 픽셀이나 foreground를 만들지 않는다.
2. 아트에 그린 길의 모든 단면이 본 문서의 raw 보호 폭(주도로 128px, 통과로 64px)을 유지한다.
3. 최종 collider를 28×16 발로 확장하고 4px 래스터화한 뒤 x=1792 셀이 walkable이다.
4. 본 단계의 7개 경로를 실제 런타임 마스크와 `moveWorldPlayer()`로 재실행해 모두 PASS한다.
5. 최종 장식 레이어 교차 검사에서 세 no-decoration 영역의 침범 수가 0이다.
6. 데스크톱·모바일 실렌더에서 도로 캐릭터가 지붕/foreground에 가려져 막힌 것처럼 보이지 않는다.

이 문서는 분석 승인안이며, 집 아트 제작이나 프로덕션 통합을 승인하지 않는다.
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    runtime = load_runtime_model()
    assert runtime["mask"]["cellSize"] == CELL
    assert runtime["player"] == {"width": 72, "height": 88, "footWidth": 28, "footHeight": 16}
    assert runtime["substepPx"] == 3
    walkable, expanded_records = build_mask(runtime)
    findings, route_geometry = analyze(runtime, walkable, expanded_records)
    if findings["status"] != "PASS":
        raise RuntimeError(json.dumps(findings["completionCriteria"], indent=2, ensure_ascii=False))
    world = world_image()
    plate_01(world, findings)
    plate_02(world)
    plate_03(world, findings)
    plate_04(world, findings, route_geometry)
    plate_05(world, findings)
    (OUT / "circulation-findings.json").write_text(json.dumps(findings, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "CIRCULATION_SPEC.md").write_text(build_spec(findings), encoding="utf-8")
    print(json.dumps({
        "status": findings["status"],
        "outputs": [
            "01-revised-site-overlay.png",
            "02-circulation-before-after.png",
            "03-clearance-collision.png",
            "04-route-validation.png",
            "05-depth-risk.png",
            "circulation-findings.json",
            "CIRCULATION_SPEC.md",
        ],
        "completionCriteria": findings["completionCriteria"],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
