import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamic import with SSR disabled. Recharts and our SVG charts use browser APIs.
const PyxaOS = dynamic(() => import('../components/PyxaOS'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Pyxa OS. Product Development Operating System</title>
        <meta name="description" content="AI-driven product development operating system for spatial transcriptomics" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <PyxaOS />
    </>
  );
}
