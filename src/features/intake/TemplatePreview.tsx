import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import { itemBusinessName, itemDescription, itemTechnicalLabel } from '../../domain/items/itemNames';
import { generateTemplate } from '../../domain/template';

/** The recommended starting template, read from the domain so it always matches what is generated. */
export function TemplatePreview() {
  const template = generateTemplate('newProduct', 'noNewMaterials');
  if (!template.supported) return null;
  return (
    <Box component="section" aria-labelledby="template-heading">
      <Typography id="template-heading" variant="h3" component="h2">
        Based on your request, we’ll start with these Request Items.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        This is a recommended starting template, not a fixed workflow. You can work on the items in any order and adjust them in
        Request Setup.
      </Typography>
      <List aria-label="Recommended Request Items" sx={{ mt: 1, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }} disablePadding>
        {template.items.map((item, index) => (
          <ListItem key={item.type} divider={index < template.items.length - 1} sx={{ display: 'block' }}>
            <Typography sx={{ fontWeight: 600 }}>{itemBusinessName(item.type)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {itemTechnicalLabel(item.type)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {itemDescription(item.type)}
            </Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
