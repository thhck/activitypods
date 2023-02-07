const { triple, namedNode, literal } = require('@rdfjs/data-model');
const { ControlledContainerMixin } = require('@semapps/ldp');
const { MIME_TYPES } = require('@semapps/mime-types');
const { AnnouncerMixin } = require('@activitypods/announcer');
const { SynchronizerMixin } = require('@activitypods/synchronizer');

module.exports = {
  name: 'openbadges.assertion',
  mixins: [SynchronizerMixin, AnnouncerMixin, ControlledContainerMixin],
  settings: {
    path: '/assertions',
    acceptedTypes: ['Assertion'],
    dereference: ['obi:recipient', 'obi:verify'],
    permissions: {},
    newResourcesPermissions: {},
    notificationMapping: {
      key: 'new_event',
      title: {
        en: `{{emitterProfile.vcard:given-name}} awarded you a badge`,
        fr: `{{emitterProfile.vcard:given-name}} vous a accordé un badge`,
      },
    },
  },
  hooks: {
    after: {
      async create(ctx, res) {
        const { resourceUri, newData: assertion, webId } = res;

        const bakedBadgeUri = await ctx.call('openbadges.baked-badge.bake', {
          assertion,
          webId
        });

        const issuer = await ctx.call('ldp.resource.get', {
          resourceUri: assertion.issuer,
          accept: MIME_TYPES.JSON,
          webId
        });

        // If issuer doesn't have a schema:name, add it
        if (!issuer['schema:name']) {
          await ctx.call('ldp.resource.patch', {
            resourceUri: assertion.issuer,
            triplesToAdd: [
              triple(
                namedNode(assertion.issuer),
                namedNode('http://schema.org/name'),
                literal(issuer['vcard:given-name'])
              )
            ],
            webId
          });
        }

        await ctx.call('ldp.resource.patch', {
          resourceUri: resourceUri,
          triplesToAdd: [
            triple(
              namedNode(resourceUri),
              namedNode('http://schema.org/image'),
              namedNode(bakedBadgeUri)
            )
          ],
          webId
        });

        const updatedAssertion = await ctx.call('ldp.resource.get', {
          resourceUri,
          accept: MIME_TYPES.JSON,
          webId
        });

        return {
          resourceUri,
          newData: updatedAssertion,
          webId
        }
      },
    },
  },
};