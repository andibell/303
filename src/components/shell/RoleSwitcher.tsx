import { useState } from 'react';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { alpha } from '@mui/material/styles';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useNavigate } from 'react-router-dom';
import { ROLE_IDS, ROLES, type RoleId } from '../../domain/access';
import { useAppStore } from '../../store/appStore';
import { withNotice } from './routeNotice';

/**
 * Prototype role switcher. The route gate redirects silently when the current page isn’t available
 * to the new role, so this component only updates the store.
 */
export function RoleSwitcher() {
  const role = useAppStore((state) => state.role);
  const setRole = useAppStore((state) => state.setRole);
  const resetDemoData = useAppStore((state) => state.resetDemoData);
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const select = (next: RoleId) => {
    setAnchor(null);
    if (next !== role) setRole(next);
  };

  const reset = () => {
    setAnchor(null);
    resetDemoData();
    navigate(ROLES.requestor.landingPath, {
      replace: true,
      ...withNotice({ severity: 'success', message: 'Demo data was reset.' }),
    });
  };

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        id="role-switcher"
        aria-haspopup="menu"
        aria-controls={anchor ? 'role-switcher-menu' : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        endIcon={<ArrowDropDownIcon />}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={(theme) => ({
          color: 'common.white',
          fontWeight: 600,
          borderColor: alpha(theme.palette.common.white, 0.6),
          '&:hover': { borderColor: 'common.white', bgcolor: alpha(theme.palette.common.white, 0.12) },
        })}
      >
        {ROLES[role].displayLabel}
      </Button>
      <Menu
        id="role-switcher-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { 'aria-labelledby': 'role-switcher' }, paper: { sx: { width: 340 } } }}
      >
        {ROLE_IDS.map((id) => (
          <MenuItem key={id} role="menuitemradio" aria-checked={id === role} selected={id === role} onClick={() => select(id)}>
            <ListItemIcon>{id === role && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText
              primary={ROLES[id].displayLabel}
              secondary={ROLES[id].description}
              slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }}
            />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={reset}>
          <ListItemIcon>
            <RestartAltIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Reset demo data" />
        </MenuItem>
      </Menu>
    </>
  );
}
