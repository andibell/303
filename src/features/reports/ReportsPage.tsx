import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeading } from '../../components/common/PageHeading';
import { ROLES } from '../../domain/access';
import { useAppStore } from '../../store/appStore';

/** Reports is a future application area. This page only says so; it shows no data and offers no controls. */
export function ReportsPage() {
  const role = useAppStore((state) => state.role);
  return (
    <>
      <PageHeading title="Reports" />
      <EmptyState
        title="Reports are planned for a future phase"
        description="This area will be where request activity and outcomes can be reviewed. It isn’t part of this proof of concept."
        action={
          <Box>
            <Link component={RouterLink} to={ROLES[role].landingPath}>
              Go to BOM Work
            </Link>
          </Box>
        }
      />
    </>
  );
}
