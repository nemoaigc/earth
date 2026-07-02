import PlanetExperience from './PlanetExperience';

// Server Component shell. All the interactive WebGL + UI lives in the
// client island so nothing browser-only is ever evaluated on the server.
export default function Page() {
  return <PlanetExperience />;
}
