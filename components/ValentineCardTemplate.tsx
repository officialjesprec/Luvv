
import React, { forwardRef } from 'react';
import { motion, Variants } from 'framer-motion';

interface ValentineCardTemplateProps {
  message: string;
  recipient: string;
  sender: string;
  isPreview?: boolean;
}

const ValentineCardTemplate = forwardRef<HTMLDivElement, ValentineCardTemplateProps>(
  ({ message, recipient, sender, isPreview = false }, ref) => {
    // Define variants with explicit type to fix motion prop mismatches
    const containerVariants: Variants = {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } }
    };

    // Use explicit Variants type and const assertion for ease to resolve string vs Easing type mismatch
    const itemVariants: Variants = {
      initial: { opacity: 0, y: 20 },
      animate: { 
        opacity: 1, 
        y: 0, 
        transition: { 
          duration: 0.8, 
          ease: "easeOut" as const 
        } 
      }
    };

    // Use const assertion for ease to resolve string vs Easing type mismatch
    const pulseVariants = {
      animate: {
        scale: [1, 1.05, 1],
        opacity: [0.05, 0.1, 0.05],
        transition: { 
          duration: 3, 
          repeat: Infinity, 
          ease: "easeInOut" as const 
        }
      }
    };

    return (
      <div 
        ref={ref}
        className={`${isPreview ? 'rounded-2xl shadow-xl' : ''} w-[1080px] h-[1920px] p-24 flex flex-col justify-center items-center text-center relative overflow-hidden`}
        style={{
          background: 'linear-gradient(135deg, #8B0000 0%, #5E0000 50%, #300000 100%)',
        }}
      >
        {/* Ornate Background Elements */}
        <motion.div 
          // Use undefined instead of {} for conditional animation prop to match expected types
          animate={isPreview ? pulseVariants.animate : undefined}
          className="absolute top-[-100px] left-[-100px] text-[#FFC0CB] opacity-[0.05] text-[600px] pointer-events-none rotate-12 select-none font-serif"
        >
          ♥
        </motion.div>
        <motion.div 
          // Use undefined instead of {} for conditional animation prop to match expected types
          animate={isPreview ? pulseVariants.animate : undefined}
          className="absolute bottom-[-100px] right-[-100px] text-[#FFC0CB] opacity-[0.05] text-[600px] pointer-events-none -rotate-12 select-none font-serif"
        >
          ♥
        </motion.div>
        
        {/* Double Border Frame */}
        <div className="absolute inset-12 border-[12px] border-[#FFC0CB] opacity-10 rounded-[120px]"></div>
        <div className="absolute inset-20 border-[2px] border-[#FFC0CB] opacity-30 rounded-[100px]"></div>

        {/* Content Container */}
        <motion.div 
          variants={containerVariants}
          initial="initial"
          animate="animate"
          className="z-10 flex flex-col items-center max-w-[900px]"
        >
          {/* Top Ornament */}
          <motion.div variants={itemVariants} className="mb-12 flex items-center gap-8 text-[#FFC0CB] opacity-40">
            <div className="w-40 h-[2px] bg-gradient-to-r from-transparent to-[#FFC0CB]"></div>
            <div className="text-4xl">♥</div>
            <div className="w-40 h-[2px] bg-gradient-to-l from-transparent to-[#FFC0CB]"></div>
          </motion.div>

          <motion.h2 variants={itemVariants} className="text-[#FFC0CB] font-serif italic text-8xl mb-8 tracking-tight">
            Happy Valentine's Day
          </motion.h2>
          
          <motion.div variants={itemVariants} className="text-[#FFC0CB] font-bold tracking-[0.6em] uppercase text-xl mb-24 opacity-60">
            to {recipient}
          </motion.div>
          
          <motion.div variants={itemVariants} className="relative mb-24">
            <div className="absolute -top-16 -left-12 text-[#FFC0CB] text-9xl opacity-10 font-serif">“</div>
            <p className="text-[#FFFDD0] font-serif text-[64px] leading-[1.3] italic px-12 drop-shadow-lg">
              {message}
            </p>
            <div className="absolute -bottom-24 -right-12 text-[#FFC0CB] text-9xl opacity-10 font-serif">”</div>
          </motion.div>
          
          <motion.div variants={itemVariants} className="mt-12 flex flex-col items-center">
            <div className="text-[#FFC0CB] font-bold tracking-[0.4em] uppercase text-2xl mb-6 opacity-80">Forever yours,</div>
            <p className="text-[#FFFDD0] font-serif text-8xl tracking-wide">{sender}</p>
          </motion.div>

          {/* Bottom Ornament */}
          <motion.div variants={itemVariants} className="mt-20 flex items-center gap-8 text-[#FFC0CB] opacity-40">
            <div className="w-24 h-[2px] bg-gradient-to-r from-transparent to-[#FFC0CB]"></div>
            <div className="text-2xl italic font-serif">2025</div>
            <div className="w-24 h-[2px] bg-gradient-to-l from-transparent to-[#FFC0CB]"></div>
          </motion.div>
        </motion.div>

        {/* Subtle Branding */}
        <div className="absolute bottom-16 w-full text-center">
          <span className="text-lg text-[#FFC0CB] opacity-30 uppercase tracking-[0.5em] font-bold">
            Created via Valentine Magic
          </span>
        </div>
      </div>
    );
  }
);

ValentineCardTemplate.displayName = 'ValentineCardTemplate';

export default ValentineCardTemplate;
