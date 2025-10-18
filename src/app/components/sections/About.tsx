import { FC } from 'react';
import { motion } from 'framer-motion';

interface AboutProps {
  isDarkMode: boolean;
}

const About: FC<AboutProps> = ({ isDarkMode }) => {
  return (
    <section id="about" className="relative flex items-center py-8">
      <motion.div 
        className="relative w-full max-w-7xl mx-auto px-4 py-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <h2 className="text-5xl font-bold text-center text-transparent bg-clip-text 
          bg-gradient-to-r from-blue-500 to-purple-500 mb-16">
          Contact Us
        </h2>
        
        <div className="flex justify-center">
          <div className={`${isDarkMode ? 'bg-[#0f1729]/80' : 'bg-white/90'} backdrop-blur-sm p-8 rounded-xl border ${isDarkMode ? 'border-blue-500/20' : 'border-slate-200'} shadow-sm max-w-7xl w-full`}>
            <div className="space-y-4 text-center">
              <div>
                <p className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  For questions, suggestions, or collaboration opportunities, please reach out to us at{' '}
                  <a 
                    href="mailto:ejli@cse.cuhk.edu.hk,lyu@cse.cuhk.edu.hk" 
                    className={`font-medium underline ${isDarkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
                  >
                    ejli@cse.cuhk.edu.hk, lyu@cse.cuhk.edu.hk
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default About;
