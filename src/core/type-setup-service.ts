import inquirer from 'inquirer';
import chalk from 'chalk';
import { AnytypeClient } from '../anytype/client';
import { AnytypeType, AnytypeProperty } from '../types/anytype';
import { TypeInfo, PropertyInfo } from './config-manager';

interface PropertyDefinition {
  name: string;
  displayName: string;
  format: string;
  description: string;
  relatedTypeId?: string; // For object properties that link to specific types
}

interface TypeDefinition {
  name: string;
  displayName: string;
  description: string;
  properties: PropertyDefinition[];
}

const SETUP_ORDER = {
  types: [
    {
      name: 'person',
      displayName: 'Person',
      description: 'Authors and researchers',
      properties: [
        { name: 'first_name', displayName: 'First Name', format: 'text', description: 'First name of the person' },
        { name: 'last_name', displayName: 'Last Name', format: 'text', description: 'Last name of the person' },
        { name: 'email', displayName: 'Email', format: 'email', description: 'Email address' },
        { name: 'orcid', displayName: 'ORCID', format: 'text', description: 'ORCID identifier' }
      ]
    } as TypeDefinition,
    {
      name: 'journal',
      displayName: 'Journal',
      description: 'Academic journals and publications',
      properties: [
        { name: 'name', displayName: 'Name', format: 'text', description: 'Journal name' },
        { name: 'issn', displayName: 'ISSN', format: 'text', description: 'International Standard Serial Number' }
      ]
    } as TypeDefinition,
    {
      name: 'book',
      displayName: 'Book', 
      description: 'Books and monographs',
      properties: [
        { name: 'title', displayName: 'Title', format: 'text', description: 'Book title' },
        { name: 'year', displayName: 'Publication Year', format: 'number', description: 'Year of publication' },
        { name: 'isbn', displayName: 'ISBN', format: 'text', description: 'International Standard Book Number' },
        { name: 'bibtex', displayName: 'BibTeX', format: 'text', description: 'BibTeX citation entry' }
      ]
    } as TypeDefinition,
    {
      name: 'article',
      displayName: 'Article',
      description: 'Research articles and papers',
      properties: [
        { name: 'title', displayName: 'Title', format: 'text', description: 'Article title' },
        { name: 'doi', displayName: 'DOI', format: 'text', description: 'Digital Object Identifier' },
        { name: 'year', displayName: 'Publication Year', format: 'number', description: 'Year of publication' },
        { name: 'url', displayName: 'URL', format: 'url', description: 'Article URL' },
        { name: 'bibtex', displayName: 'BibTeX', format: 'text', description: 'BibTeX citation entry' },
        { name: 'read', displayName: 'Read Status', format: 'checkbox', description: 'Whether the article has been read' }
      ]
    } as TypeDefinition
  ]
};

export class StreamlinedSetupService {
  private availableTypes: AnytypeType[] = [];
  private availableProperties: AnytypeProperty[] = [];
  private createdTypes: { [name: string]: TypeInfo } = {};

  constructor(private client: AnytypeClient) {}

  async setupComplete(): Promise<{ [typeName: string]: TypeInfo }> {
    console.log(chalk.blue('\n🚀 Setting up Anytype Bibliography Manager\n'));
    
    // Fetch all available types and properties
    await this.loadAvailableItems();
    
    // Setup types and properties in the correct order
    for (const typeDef of SETUP_ORDER.types) {
      await this.setupType(typeDef);
    }

    // Add relational properties now that all types exist
    await this.setupRelationalProperties();

    console.log(chalk.green('\n✅ Setup completed successfully!'));
    return this.createdTypes;
  }

  private async loadAvailableItems(): Promise<void> {
    console.log(chalk.blue('🔍 Loading available types and properties...'));
    this.availableTypes = await this.client.getAllTypesWithProperties();
    
    // Extract all properties from all types
    this.availableProperties = [];
    for (const type of this.availableTypes) {
      if (type.properties) {
        this.availableProperties.push(...type.properties);
      }
    }
    
    console.log(chalk.gray(`  Found ${this.availableTypes.length} types and ${this.availableProperties.length} properties`));
  }

  private async setupType(typeDef: TypeDefinition): Promise<void> {
    console.log(chalk.cyan(`\n📋 Setting up ${typeDef.displayName} type:`));
    
    // Find or create the type
    const typeInfo = await this.findOrCreateType(typeDef);
    
    // Setup properties for this type
    const properties: { [name: string]: PropertyInfo } = {};
    for (const propDef of typeDef.properties) {
      const propInfo = await this.findOrCreateProperty(propDef);
      properties[propDef.name] = propInfo;
    }
    
    this.createdTypes[typeDef.name] = {
      id: typeInfo.id,
      name: typeInfo.name,
      properties
    };
    
    console.log(chalk.green(`✅ ${typeDef.displayName} setup complete`));
  }

  private async findOrCreateType(typeDef: TypeDefinition): Promise<{ id: string; name: string }> {
    const matchingTypes = this.findMatchingTypes(typeDef.name, typeDef.displayName);
    
    if (matchingTypes.length > 0) {
      console.log(chalk.yellow(`Found ${matchingTypes.length} potential matches for ${typeDef.displayName}:`));
      matchingTypes.forEach((type, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${type.name}`));
      });

      const choices = [
        ...matchingTypes.map((type, index) => ({
          name: `Use "${type.name}"`,
          value: `existing_${index}`
        })),
        { name: `Create new "${typeDef.displayName}" type`, value: 'create_new' }
      ];

      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: `What would you like to do for ${typeDef.displayName}?`,
        choices
      }]);

      if (action.startsWith('existing_')) {
        const index = parseInt(action.split('_')[1]);
        const selectedType = matchingTypes[index];
        return { id: selectedType.id, name: selectedType.name };
      }
    }

    // Create new type
    console.log(chalk.blue(`🏗️ Creating new ${typeDef.displayName} type...`));
    const newType = await this.client.createNewObjectType(typeDef.displayName);
    if (!newType) {
      throw new Error(`Failed to create ${typeDef.displayName} type`);
    }
    
    console.log(chalk.green(`✅ Created "${newType.name}" type`));
    return { id: newType.id, name: newType.name };
  }

  private async findOrCreateProperty(propDef: PropertyDefinition): Promise<PropertyInfo> {
    const matchingProperties = this.findMatchingProperties(propDef.name, propDef.displayName);
    
    if (matchingProperties.length > 0) {
      console.log(chalk.yellow(`  Found ${matchingProperties.length} potential matches for ${propDef.displayName}:`));
      matchingProperties.forEach((prop, index) => {
        console.log(chalk.gray(`    ${index + 1}. ${prop.name} (${prop.format})`));
      });

      const choices = [
        ...matchingProperties.map((prop, index) => ({
          name: `Use "${prop.name}" (${prop.format})`,
          value: `existing_${index}`
        })),
        { name: `Create new "${propDef.displayName}" property`, value: 'create_new' }
      ];

      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: `  What would you like to do for ${propDef.displayName} property?`,
        choices
      }]);

      if (action.startsWith('existing_')) {
        const index = parseInt(action.split('_')[1]);
        const selectedProperty = matchingProperties[index];
        return {
          id: selectedProperty.id,
          name: selectedProperty.name,
          format: selectedProperty.format
        };
      }
    }

    // Create new property - but we need a type to attach it to
    // For now, we'll create a placeholder and handle this later
    throw new Error('Property creation without type context not yet implemented');
  }

  private async setupRelationalProperties(): Promise<void> {
    console.log(chalk.blue('\n🔗 Setting up relational properties...'));
    
    // Add Authors property to Article (links to Person)
    if (this.createdTypes.article && this.createdTypes.person) {
      await this.addRelationalProperty(
        this.createdTypes.article.id,
        'authors',
        'Authors',
        'objects',
        'Article authors',
        this.createdTypes.person.id
      );
    }

    // Add Journal property to Article (links to Journal)  
    if (this.createdTypes.article && this.createdTypes.journal) {
      await this.addRelationalProperty(
        this.createdTypes.article.id,
        'journal',
        'Journal',
        'objects',
        'Publication journal',
        this.createdTypes.journal.id
      );
    }

    // Add Authors property to Book (links to Person)
    if (this.createdTypes.book && this.createdTypes.person) {
      await this.addRelationalProperty(
        this.createdTypes.book.id,
        'authors',
        'Authors', 
        'objects',
        'Book authors',
        this.createdTypes.person.id
      );
    }
  }

  private async addRelationalProperty(
    typeId: string,
    propName: string,
    propDisplayName: string,
    format: string,
    _description: string,
    _relatedTypeId: string
  ): Promise<void> {
    console.log(chalk.blue(`  Adding ${propDisplayName} property...`));
    
    const newProperty = await this.client.createNewProperty(typeId, propDisplayName, format);
    if (!newProperty) {
      throw new Error(`Failed to create ${propDisplayName} property`);
    }

    // Find the type this property belongs to and add it
    for (const [typeName, typeInfo] of Object.entries(this.createdTypes)) {
      if (typeInfo.id === typeId) {
        this.createdTypes[typeName].properties[propName] = {
          id: newProperty.id,
          name: newProperty.name,
          format: newProperty.format
        };
        break;
      }
    }

    console.log(chalk.green(`  ✅ Added ${propDisplayName} property`));
  }

  private findMatchingTypes(searchName: string, displayName: string): AnytypeType[] {
    const searchTerms = [searchName, displayName.toLowerCase()];
    
    return this.availableTypes.filter(type => {
      const name = type.name?.toLowerCase() || '';
      return searchTerms.some(term => name.includes(term));
    });
  }

  private findMatchingProperties(searchName: string, displayName: string): AnytypeProperty[] {
    const searchTerms = [searchName, displayName.toLowerCase()];
    
    return this.availableProperties.filter(prop => {
      const name = prop.name?.toLowerCase() || '';
      return searchTerms.some(term => name.includes(term));
    });
  }
}