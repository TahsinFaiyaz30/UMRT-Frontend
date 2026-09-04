import type { Metadata } from 'next';
import { PremiumNavbar } from '@/components/navbar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ApplyButton } from '@/components/join/ApplyButton';
import { JoinModelViewer } from '@/components/join/JoinModelViewer';

export const metadata: Metadata = {
  title: 'Join Us - UMRT // Built Beyond Earth',
  description: 'Apply to join the UIU Mars Rover Team.',
};

export default function JoinPage() {
  return (
    <>
      <PremiumNavbar />
      <main className="join-page relative min-h-screen" style={{ background: '#050504' }}>
        <div className="join-container">
          <div className="join-content">
            <h1 className="join-title">Join the UMRT team</h1>
            <p className="join-description">
              Are you passionate about pushing the boundaries of space robotics, engineering, and innovation? 
              UMRT is the place for you! Join a dynamic and diverse team of students dedicated to designing, 
              building, and programming cutting-edge rovers. Whether you're an engineer, a programmer, a designer, 
              or someone eager to learn and contribute, you'll find a supportive environment where your skills 
              and creativity can thrive. Collaborate on exciting projects, compete in international competitions, 
              and gain hands-on experience that will propel your career. Become a part of the UIU Mars Rover Team 
              and help us shape the future of robotics today!
            </p>
            <div className="join-cta-group">
              <ApplyButton />
              <span className="join-deadline">
                Application Deadline: <strong>Friday September 18th</strong>
              </span>
            </div>
          </div>
          
          <div className="join-image-panel">
            <JoinModelViewer />
            <div className="join-image-overlay" style={{ pointerEvents: 'none' }}>
              <h2>JOIN<br/>THE<br/>TEAM</h2>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
