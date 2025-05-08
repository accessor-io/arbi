# CSS Architecture

This document describes the CSS architecture used in this project.

## File Structure

- `src/ui/styles/main.css`: Core styles and components used throughout the application
- `src/ui/public/styles.css`: Public-facing styles that extend main.css

## CSS Organization

The CSS is organized following a component-based approach:

1. **Reset and Base Styles**: Basic styling defaults and resets
2. **Typography**: Text styling including headings and paragraphs
3. **Layout**: Container, grid, and general structural elements
4. **Components**: Reusable UI components like buttons, cards, etc.
5. **Tables**: Data presentation styles
6. **Forms**: Input elements and form layouts
7. **Dashboard**: Dashboard-specific components and layouts
8. **Responsive**: Media queries for different screen sizes

## Naming Conventions

- Classes use kebab-case (e.g., `form-group`, `btn-primary`)
- Components use a BEM-inspired approach (Block, Element, Modifier)
  - Block: `.card`
  - Element: `.card-header`
  - Modifier: `.btn-primary`

## Usage Guidelines

1. Always use the class-based system rather than styling elements directly
2. Keep specificity low by avoiding deep nesting
3. Use the grid system for layout instead of custom positioning
4. Add new components to the appropriate section in the CSS files
5. Maintain responsive design by testing all changes on multiple screen sizes 