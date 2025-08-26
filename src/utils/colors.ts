export const aravoColors = {
  // Primary Aravo gradient colors
  primary: {
    red: '#FF4B4B',
    orange: '#FF6B35', 
    yellow: '#FFB347',
    gold: '#FFD700'
  },
  
  // Gradient combinations
  gradients: {
    primary: 'linear-gradient(135deg, #FF4B4B 0%, #FFB347 100%)',
    subtle: 'linear-gradient(135deg, #FFF5F5 0%, #FFFBF0 100%)',
    accent: 'linear-gradient(90deg, #FF6B35 0%, #FFD700 100%)'
  },
  
  // Professional base colors
  neutral: {
    white: '#FFFFFF',
    gray50: '#F8F9FA',
    gray100: '#E9ECEF',
    gray200: '#DEE2E6',
    gray300: '#CED4DA',
    gray400: '#ADB5BD',
    gray500: '#6C757D',
    gray600: '#495057',
    gray700: '#343A40',
    gray800: '#212529',
    gray900: '#000000'
  },
  
  // Status colors (don't compromise UX)
  status: {
    success: '#28A745',
    warning: '#FFC107', 
    error: '#DC3545',
    info: '#17A2B8'
  },
  
  // Confidence indicators
  confidence: {
    high: '#28A745',     // Green
    medium: '#FFB347',   // Aravo yellow
    low: '#DC3545'       // Red
  }
};

// CSS custom properties
export const cssVariables = `
  :root {
    --aravo-primary: ${aravoColors.primary.red};
    --aravo-accent: ${aravoColors.primary.orange};
    --aravo-gradient: ${aravoColors.gradients.primary};
    --aravo-gradient-subtle: ${aravoColors.gradients.subtle};
  }
`;

// Design principles for components
export const designPrinciples = {
    // Use Aravo colors for:
    branding: [
      'Header gradients',
      'CTA buttons', 
      'Progress indicators',
      'Success metrics',
      'Brand elements'
    ],
    
    // Keep standard UX colors for:
    functionality: [
      'Error states (red)',
      'Success states (green)', 
      'Warning states (amber)',
      'Text (grays)',
      'Backgrounds (whites/grays)'
    ],
    
    // Accessibility requirements:
    accessibility: [
      'WCAG 2.1 AA contrast ratios',
      'No color-only information',
      'Focus indicators visible',
      'Text readable on all backgrounds'
    ]
};