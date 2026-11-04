import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { PERSONAS } from '../../data/personas';
import { useAppStore } from '../../store/appStore';
import { sizing } from '../../theme/tokens';
import { RoleSwitcher } from './RoleSwitcher';

export function AppHeader() {
  const role = useAppStore((state) => state.role);
  const persona = PERSONAS[role];

  return (
    <AppBar
      position="static"
      component="header"
      sx={(theme) => ({
        bgcolor: 'common.black',
        color: 'common.white',
        '& :focus-visible': { outlineColor: theme.palette.info.light },
      })}
    >
      <Toolbar sx={{ minHeight: { xs: 48, sm: sizing.headerHeight }, gap: { xs: 1.5, sm: 2 }, px: { xs: 2, md: 3 }, py: { xs: 0.5, sm: 0 }, flexWrap: 'wrap' }}>
        <Typography variant="h2" component="p" sx={{ fontSize: '1.125rem', lineHeight: 1 }}>
          BOM Pilot
        </Typography>
        <Box
          aria-hidden
          sx={(theme) => ({ width: '1px', height: 24, bgcolor: alpha(theme.palette.common.white, 0.4) })}
        />
        <Box sx={{ flexGrow: 1 }} />
        <RoleSwitcher />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar aria-hidden sx={{ width: 32, height: 32, fontSize: '0.8125rem', bgcolor: 'secondary.main' }}>{persona.initials}</Avatar>
          <Box sx={{ display: { xs: 'none', md: 'block' }, lineHeight: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {persona.name}
            </Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
