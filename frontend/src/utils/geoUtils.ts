/**
 * Utilitaires géographiques pour la cartographie
 */

/**
 * Calculer le centroïde d'une géométrie
 */
export function getCentroid(geometry: GeoJSON.Geometry): [number, number] {
    if (geometry.type === 'Point') {
        return geometry.coordinates as [number, number]
    }

    if (geometry.type === 'Polygon') {
        const coords = geometry.coordinates[0]
        return calculateCentroidFromCoords(coords)
    }

    if (geometry.type === 'MultiPolygon') {
        // Prendre le premier polygone
        const coords = geometry.coordinates[0][0]
        return calculateCentroidFromCoords(coords)
    }

    // Fallback
    return [0, 0]
}

/**
 * Calculer le centroïde à partir de coordonnées
 */
function calculateCentroidFromCoords(coords: number[][]): [number, number] {
    let x = 0
    let y = 0
    const numPoints = coords.length

    for (const coord of coords) {
        x += coord[0]
        y += coord[1]
    }

    return [x / numPoints, y / numPoints]
}

/**
 * Obtenir les limites géographiques d'un ensemble de features
 */
export function getBounds(features: GeoJSON.Feature[]): {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
} | null {
    if (features.length === 0) return null

    let minLat = Infinity
    let maxLat = -Infinity
    let minLng = Infinity
    let maxLng = -Infinity

    for (const feature of features) {
        const bounds = getGeometryBounds(feature.geometry)
        if (bounds) {
            minLat = Math.min(minLat, bounds.minLat)
            maxLat = Math.max(maxLat, bounds.maxLat)
            minLng = Math.min(minLng, bounds.minLng)
            maxLng = Math.max(maxLng, bounds.maxLng)
        }
    }

    if (minLat === Infinity) return null

    return { minLat, maxLat, minLng, maxLng }
}

/**
 * Obtenir les limites d'une géométrie
 */
function getGeometryBounds(geometry: GeoJSON.Geometry) {
    if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates
        return { minLat: lat, maxLat: lat, minLng: lng, maxLng: lng }
    }

    if (geometry.type === 'Polygon') {
        return getBoundsFromCoords(geometry.coordinates[0])
    }

    if (geometry.type === 'MultiPolygon') {
        let minLat = Infinity
        let maxLat = -Infinity
        let minLng = Infinity
        let maxLng = -Infinity

        for (const polygon of geometry.coordinates) {
            const bounds = getBoundsFromCoords(polygon[0])
            if (bounds) {
                minLat = Math.min(minLat, bounds.minLat)
                maxLat = Math.max(maxLat, bounds.maxLat)
                minLng = Math.min(minLng, bounds.minLng)
                maxLng = Math.max(maxLng, bounds.maxLng)
            }
        }

        return { minLat, maxLat, minLng, maxLng }
    }

    return null
}

/**
 * Obtenir les limites depuis des coordonnées
 */
function getBoundsFromCoords(coords: number[][]) {
    let minLat = Infinity
    let maxLat = -Infinity
    let minLng = Infinity
    let maxLng = -Infinity

    for (const [lng, lat] of coords) {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
    }

    return { minLat, maxLat, minLng, maxLng }
}

/**
 * Simplifier une géométrie pour améliorer les performances
 * Utilise l'algorithme de Douglas-Peucker
 */
export function simplifyGeometry(
    geometry: GeoJSON.Geometry,
    tolerance: number = 0.001
): GeoJSON.Geometry {
    if (geometry.type === 'Polygon') {
        return {
            type: 'Polygon',
            coordinates: geometry.coordinates.map(ring =>
                simplifyRing(ring, tolerance)
            ),
        }
    }

    if (geometry.type === 'MultiPolygon') {
        return {
            type: 'MultiPolygon',
            coordinates: geometry.coordinates.map(polygon =>
                polygon.map(ring => simplifyRing(ring, tolerance))
            ),
        }
    }

    // Ne pas simplifier les autres types
    return geometry
}

/**
 * Simplifier un anneau de polygone
 */
function simplifyRing(ring: number[][], tolerance: number): number[][] {
    if (ring.length <= 3) return ring

    // Algorithme de Douglas-Peucker simplifié
    const sqTolerance = tolerance * tolerance
    let markers: boolean[] = new Array(ring.length).fill(false)
    markers[0] = true
    markers[ring.length - 1] = true

    simplifyDouglasPeucker(ring, markers, sqTolerance, 0, ring.length - 1)

    return ring.filter((_, i) => markers[i])
}

/**
 * Algorithme de Douglas-Peucker récursif
 */
function simplifyDouglasPeucker(
    ring: number[][],
    markers: boolean[],
    sqTolerance: number,
    first: number,
    last: number
) {
    let maxSqDist = 0
    let index = 0

    for (let i = first + 1; i < last; i++) {
        const sqDist = getSquareSegmentDistance(ring[i], ring[first], ring[last])

        if (sqDist > maxSqDist) {
            index = i
            maxSqDist = sqDist
        }
    }

    if (maxSqDist > sqTolerance) {
        markers[index] = true
        simplifyDouglasPeucker(ring, markers, sqTolerance, first, index)
        simplifyDouglasPeucker(ring, markers, sqTolerance, index, last)
    }
}

/**
 * Distance au carré d'un point à un segment
 */
function getSquareSegmentDistance(
    p: number[],
    p1: number[],
    p2: number[]
): number {
    let x = p1[0]
    let y = p1[1]
    let dx = p2[0] - x
    let dy = p2[1] - y

    if (dx !== 0 || dy !== 0) {
        const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)

        if (t > 1) {
            x = p2[0]
            y = p2[1]
        } else if (t > 0) {
            x += dx * t
            y += dy * t
        }
    }

    dx = p[0] - x
    dy = p[1] - y

    return dx * dx + dy * dy
}

/**
 * Vérifier si un point est dans les limites
 */
export function isPointInBounds(
    lat: number,
    lng: number,
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): boolean {
    return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng
}

/**
 * Convertir des codes communes en paramètres d'API
 */
export function communeCodesToParams(codes: string[]): string {
    return codes.map(code => `codes=${code}`).join('&')
}

/**
 * Obtenir le niveau de zoom approprié pour une bounding box
 */
export function getZoomLevel(bounds: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
}): number {
    const latDiff = bounds.maxLat - bounds.minLat
    const lngDiff = bounds.maxLng - bounds.minLng
    const maxDiff = Math.max(latDiff, lngDiff)

    // Formule approximative
    if (maxDiff > 10) return 6
    if (maxDiff > 5) return 7
    if (maxDiff > 2) return 8
    if (maxDiff > 1) return 9
    if (maxDiff > 0.5) return 10
    if (maxDiff > 0.2) return 11
    if (maxDiff > 0.1) return 12
    return 13
}
