import { Family, FinalCta, Hero, Intro, Learn, Production, Showcase, Steps } from '@/components/home/Sections';
import { Footer } from '@/components/ui/Footer';
import { Header } from '@/components/ui/Header';
import { getMessages } from '@/i18n/server';

export default async function Home() {
  const { t, locale } = await getMessages();
  const props = { t, locale };
  return (
    <>
      <Header />
      <main>
        <Hero {...props} />
        <Intro {...props} />
        <Steps {...props} />
        <Learn {...props} />
        <Family {...props} />
        <Showcase {...props} />
        <Production {...props} />
        <FinalCta {...props} />
      </main>
      <Footer {...props} />
    </>
  );
}
