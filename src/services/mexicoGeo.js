import { geoMercator, geoPath } from 'd3-geo';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 520;

const geojsonPath = path.join(__dirname, '../data/mexico-states.json');
const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

export function getStatePaths() {
  const projection = geoMercator().fitExtent(
    [
      [12, 12],
      [MAP_WIDTH - 12, MAP_HEIGHT - 12],
    ],
    geojson,
  );
  const pathGenerator = geoPath(projection);

  return geojson.features.map((feature) => ({
    id: feature.properties.id,
    estado: feature.properties.name,
    d: pathGenerator(feature) || '',
    centroid: pathGenerator.centroid(feature),
  }));
}
