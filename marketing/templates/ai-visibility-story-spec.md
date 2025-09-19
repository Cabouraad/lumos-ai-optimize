# AI Visibility Story Infographic Template Specification

## Design Requirements

### Dimensions
- **Primary**: 1080×1920 px (9:16 aspect ratio - Instagram/TikTok Stories)
- **Export Format**: PNG with transparent background option
- **DPI**: 72 for social media, 150 for high-quality

### Layout Structure

```
┌─────────────────────────────────────────────┐
│ TOP BAR (1080×160px)                        │
│ ┌─────────┐           ┌───────────────────┐ │
│ │  LOGO   │           │ AI VISIBILITY     │ │
│ │ (80×40) │           │ INDEX             │ │
│ └─────────┘           │ Week: [DATE]      │ │
│                       └───────────────────┘ │
├─────────────────────────────────────────────┤
│                                             │
│ MAIN BODY (1080×1200px)                     │
│                                             │
│  TOP 5 BRANDS RANKING                       │
│  ┌─────────────────────────────────────────┐ │
│  │ 🥇 1. Brand Name        45.2% ↗ +12.5% │ │
│  │                                         │ │
│  │ 🥈 2. Brand Name        38.7% ↘ -3.2%  │ │
│  │                                         │ │
│  │ 🥉 3. Brand Name        28.1% ↗ +5.8%  │ │
│  │                                         │ │
│  │ 📈 4. Brand Name        22.4% ↗ +2.1%  │ │
│  │                                         │ │
│  │ 📊 5. Brand Name        18.9% ↘ -1.7%  │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  KEY TRENDS BOX (1080×280px)                │
│  ┌─────────────────────────────────────────┐ │
│  │ 🔥 KEY TRENDS                           │ │
│  │                                         │ │
│  │ • AI model updates drove mentions up   │ │
│  │ • B2B queries grew 23% this week       │ │
│  │ • Enterprise focus increasing          │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ FOOTER CTA (1080×280px)                     │
│                                             │
│ Want to see YOUR brand's AI visibility?     │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │          Try Llumos Free                │ │
│ │             llumos.ai                   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│               LLUMOS LOGO                   │
└─────────────────────────────────────────────┘
```

## Style Guide

### Colors (HSL Format)
```css
--primary-blue: 220 85% 32%;     /* #1E3A8A */
--secondary-green: 158 74% 40%;  /* #10B981 */
--accent-orange: 26 91% 53%;     /* #F97316 */
--neutral-gray: 218 11% 45%;     /* #6B7280 */
--light-gray: 210 20% 98%;       /* #F9FAFB */
--text-dark: 218 27% 26%;        /* #374151 */
--white: 0 0% 100%;              /* #FFFFFF */
```

### Typography (Mobile Optimized)
- **Headers**: Poppins Bold/SemiBold
- **Body Text**: Inter Regular/Medium
- **Metrics**: Roboto Mono Regular/Bold

### Font Sizes (Vertical Layout)
- **Title**: 28px (Poppins Bold)
- **Week Range**: 16px (Inter Medium)
- **Brand Names**: 20px (Inter SemiBold)
- **Percentages**: 18px (Roboto Mono Bold)
- **Changes**: 14px (Roboto Mono Regular)
- **Trends Title**: 18px (Poppins SemiBold)
- **Bullets**: 14px (Inter Regular)
- **CTA Text**: 16px (Inter Medium)
- **CTA Button**: 18px (Poppins SemiBold)

### Icons & Emojis
- **Rank 1**: 🥇 (Gold Medal)
- **Rank 2**: 🥈 (Silver Medal)
- **Rank 3**: 🥉 (Bronze Medal)
- **Rank 4**: 📈 (Chart Increasing)
- **Rank 5**: 📊 (Bar Chart)
- **Trends**: 🔥 (Fire)
- **Trend Up**: ↗ (Green #10B981)
- **Trend Down**: ↘ (Orange #F97316)

## Component Specifications

### Top Bar
- **Background**: Primary Blue (#1E3A8A)
- **Height**: 160px
- **Logo**: White version, 80×40px, left-aligned with 20px margin
- **Title**: "AI VISIBILITY INDEX" - Poppins Bold 28px, White
- **Week**: "Week: [March 15-21, 2024]" - Inter Medium 16px, White opacity 80%
- **Layout**: Logo left, title/date right-aligned

### Brand Ranking Rows
- **Height**: 120px each
- **Background**: White with alternating Light Gray (#F9FAFB)
- **Border**: 1px solid #E5E7EB bottom border
- **Padding**: 20px horizontal, 15px vertical
- **Emoji**: 28px size, left-aligned
- **Brand Name**: Inter SemiBold 20px, Text Dark
- **Percentage**: Roboto Mono Bold 18px, Primary Blue
- **Change**: Roboto Mono Regular 14px, Green/Orange based on trend
- **Arrow**: 16px, Green/Orange
- **Layout**: Vertical stacking for mobile readability

### Key Trends Box
- **Background**: Light Gray (#F9FAFB)
- **Border**: 2px solid Secondary Green (#10B981)
- **Border Radius**: 12px
- **Padding**: 24px
- **Height**: 280px
- **Icon**: 🔥 24px
- **Title**: "KEY TRENDS" - Poppins SemiBold 18px
- **Bullets**: Inter Regular 14px, line-height 1.6
- **Bullet Color**: Secondary Green

### Footer CTA
- **Background**: Primary Blue (#1E3A8A)
- **Height**: 280px
- **Text Color**: White
- **CTA Question**: Inter Medium 16px, centered
- **Button**: 
  - Background: White
  - Text: Primary Blue, Poppins SemiBold 18px
  - Padding: 16px 32px
  - Border Radius: 8px
  - Text: "Try Llumos Free"
- **URL**: Inter Regular 14px, White opacity 80%
- **Logo**: White version, 60×30px, bottom center

## Mobile Optimization Features

### Readability Enhancements
- **Larger text sizes** for mobile viewing
- **Higher contrast ratios** for small screens
- **Simplified layout** with clear visual hierarchy
- **Touch-friendly spacing** between elements
- **Single column design** for vertical scrolling

### Visual Hierarchy
1. **Top Bar**: Eye-catching header with branding
2. **Rankings**: Large, easy-to-scan brand list
3. **Trends**: Highlighted insights box
4. **CTA**: Strong call-to-action footer

## Editable Elements Template

### Weekly Data Variables
```json
{
  "week_range": "March 15-21, 2024",
  "brands": [
    {
      "rank": 1,
      "emoji": "🥇",
      "name": "OpenAI",
      "percentage": "45.2%",
      "change": "+12.5%",
      "trend": "up"
    }
  ],
  "trends": [
    "AI model updates drove mentions up",
    "B2B queries grew 23% this week", 
    "Enterprise focus increasing"
  ]
}
```

## Export Settings

### Platform Specifications
- **Instagram Stories**: 1080×1920px, PNG, 72 DPI
- **TikTok**: 1080×1920px, PNG, 72 DPI
- **LinkedIn Stories**: 1080×1920px, PNG, 72 DPI
- **High Resolution**: 1080×1920px, PNG, 150 DPI

### Mobile Optimization
- **Safe Area**: 60px margins from screen edges
- **Text Size**: Minimum 14px for readability
- **Touch Targets**: Minimum 44px for interactive elements
- **Contrast**: WCAG AA compliant ratios

## Animation Possibilities

### Micro-Animations (Optional)
- **Trend arrows**: Subtle bounce animation
- **Percentage changes**: Count-up animation
- **CTA button**: Gentle pulse effect
- **Brand rows**: Staggered entrance animation

### Export Formats
- **Static PNG**: Standard for most platforms
- **Animated GIF**: For enhanced engagement
- **Video MP4**: For TikTok/Instagram Reels

## Usage Guidelines

### Content Strategy
- **Hook**: Start with biggest trend/winner
- **Scan**: Easy-to-read brand rankings
- **Insight**: Key trends that matter
- **Action**: Clear CTA to engage

### Distribution Best Practices
- **Post Time**: Peak engagement hours per platform
- **Hashtags**: #AISearch #BrandVisibility #MarketingData
- **Stories Features**: Use platform-specific stickers/polls
- **Cross-Platform**: Consistent branding across channels

## Technical Specifications

### File Organization
```
📁 AI Visibility Story Template
  📁 Header
    🎨 Background
    🖼️ Logo
    📝 Title
    📝 Week
  📁 Rankings
    📁 Brand Row Component (x5)
  📁 Trends Box
    🎨 Background
    📝 Content
  📁 Footer CTA
    🎨 Background
    🖼️ Button
    📝 CTA Text
    🖼️ Logo
```

### Component System
- **Brand Row Component**: Reusable with data variables
- **Trend Box Component**: Editable bullet points
- **Header Component**: Date/week variable
- **CTA Component**: Trackable link integration