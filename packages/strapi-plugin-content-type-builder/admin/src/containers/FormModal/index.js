import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  ButtonModal,
  HeaderModal,
  HeaderModalTitle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalForm,
  getYupInnerErrors,
  useGlobalContext,
  InputsIndex,
} from 'strapi-helper-plugin';
import { Inputs } from '@buffetjs/custom';
import { useHistory, useLocation } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { get, has, isEmpty, set, toString, upperFirst } from 'lodash';
import pluginId from '../../pluginId';
import useQuery from '../../hooks/useQuery';
import useDataManager from '../../hooks/useDataManager';
import AttributeOption from '../../components/AttributeOption';
import BooleanBox from '../../components/BooleanBox';
import CustomCheckbox from '../../components/CustomCheckbox';
import ModalHeader from '../../components/ModalHeader';
import HeaderModalNavContainer from '../../components/HeaderModalNavContainer';
import HeaderNavLink from '../../components/HeaderNavLink';
import getTrad from '../../utils/getTrad';
import getAttributes from './utils/attributes';
import forms from './utils/forms';
import { createUid } from './utils/createUid';
import init from './init';
import reducer, { initialState } from './reducer';
import RelationForm from '../../components/RelationForm';

const NAVLINKS = [{ id: 'base' }, { id: 'advanced' }];

const FormModal = () => {
  const initialStateData = {
    attributeName: null,
    actionType: null,
    modalType: null,
    settingType: null,
    forTarget: null,
    targetUid: null,
    attributeType: null,
    headerDisplayName: null,
    pathToSchema: [],
  };
  const [state, setState] = useState(initialStateData);
  const [reducerState, dispatch] = useReducer(reducer, initialState, init);
  const { push } = useHistory();
  const { search } = useLocation();
  const { formatMessage } = useGlobalContext();
  const query = useQuery();
  const attributeOptionRef = useRef();
  const {
    addAttribute,
    contentTypes,
    createSchema,
    modifiedData: allDataSchema,
    sortedContentTypesList,
  } = useDataManager();
  const { formErrors, initialData, modifiedData } = reducerState.toJS();

  useEffect(() => {
    if (!isEmpty(search)) {
      console.log('up');
      // Return 'null' if there isn't any attributeType search params
      const attributeType = query.get('attributeType');
      const modalType = query.get('modalType');
      const actionType = query.get('actionType');
      const attributeName = query.get('attributeName');
      const settingType = query.get('settingType');
      const forTarget = query.get('forTarget');
      const targetUid = query.get('targetUid');
      const headerDisplayName = query.get('headerDisplayName');
      const pathToSchema =
        forTarget === 'contentType' || forTarget === 'component'
          ? [forTarget]
          : [forTarget, targetUid];

      setState({
        attributeName,
        actionType,
        modalType,
        settingType,
        forTarget,
        targetUid,
        headerDisplayName,
        attributeType,
        pathToSchema,
      });

      // Set the predefined data structure to create an attribute
      if (
        attributeType &&
        attributeType !== 'null' &&
        // This condition is added to prevent the reducer state to be cleared when navigating from the base tab to tha advanced one
        state.modalType !== 'attribute'
      ) {
        const attributeToEditNotFormatted = get(
          allDataSchema,
          [...pathToSchema, 'schema', 'attributes', attributeName],
          {}
        );
        const attributeToEdit = {
          ...attributeToEditNotFormatted,
          name: attributeName,
        };

        if (
          attributeType === 'relation' &&
          !has(attributeToEdit, ['targetAttribute'])
        ) {
          set(attributeToEdit, ['targetAttribute'], '-');
        }

        dispatch({
          type: 'SET_ATTRIBUTE_DATA_SCHEMA',
          attributeType,
          nameToSetForRelation: get(
            sortedContentTypesList,
            ['0', 'title'],
            'error'
          ),
          targetUid: get(sortedContentTypesList, ['0', 'uid'], 'error'),
          isEditing: actionType === 'edit',
          modifiedDataToSetForEditing: attributeToEdit,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const form = get(forms, [state.modalType, 'form', state.settingType], () => ({
    items: [],
  }));
  const iconType = ['components', 'contentType'].includes(state.modalType)
    ? state.modalType
    : state.forTarget;
  const isCreatingCT = state.modalType === 'contentType';
  const isCreating = state.actionType === 'create';
  const isOpen = !isEmpty(search);
  const isPickingAttribute = state.modalType === 'chooseAttribute';
  const uid = createUid(modifiedData.name || '');

  let headerId = isCreating
    ? `modalForm.${state.modalType}.header-create`
    : 'modalForm.header-edit';

  if (!['contentType', 'component'].includes(state.modalType)) {
    headerId = null;
  }

  const checkFormValidity = async () => {
    let schema;

    if (state.modalType === 'contentType') {
      schema = forms[state.modalType].schema(Object.keys(contentTypes));
    } else if (
      state.modalType === 'attribute'
      // && state.forTarget !== 'components' &&
      // state.forTarget !== 'component'
    ) {
      const type =
        state.attributeType === 'relation' ? 'relation' : modifiedData.type;
      console.log({ pathToSchema: state.pathToSchema });
      schema = forms[state.modalType].schema(
        get(allDataSchema, state.pathToSchema, {}),
        type,
        modifiedData,
        state.actionType === 'edit',
        state.attributeName,
        initialData
      );
    } else {
      // TODO validate component schema
      console.log('Will do something');

      return;
    }

    await schema.validate(modifiedData, { abortEarly: false });
  };

  const getModalTitleSubHeader = () => {
    switch (state.modalType) {
      case 'chooseAttribute':
        return getTrad(
          `modalForm.sub-header.chooseAttribute.${
            state.forTarget === 'contentType' ? 'contentType' : 'component'
          }`
        );
      case 'attribute':
        return getTrad(`modalForm.sub-header.attribute.${state.actionType}`);
      default:
        return getTrad('configurations');
    }
  };

  const getNextSearch = nextTab => {
    const newSearch = Object.keys(state).reduce((acc, current, index) => {
      if (current !== 'settingType') {
        acc = `${acc}${index === 0 ? '' : '&'}${current}=${state[current]}`;
      } else {
        acc = `${acc}${index === 0 ? '' : '&'}${current}=${nextTab}`;
      }

      return acc;
    }, '');

    return newSearch;
  };

  const handleChange = ({ target: { name, value, type, ...rest } }) => {
    const namesThatCanResetToNullValue = [
      'enumName',
      'max',
      'min',
      'maxLength',
      'minLength',
    ];
    let val;

    if (
      ['default', ...namesThatCanResetToNullValue].includes(name) &&
      value === ''
    ) {
      val = null;
    } else if (type === 'radio' && (name === 'multiple' || name === 'single')) {
      val = value === 'false' ? false : true;
    } else if (type === 'radio' && name === 'default') {
      if (value === 'false') {
        val = false;
      } else if (value === 'true') {
        val = true;
      } else {
        val = null;
      }
      // val = value === 'false' ? false : true;
    } else if (name === 'enum') {
      val = value.split('\n');
    } else {
      val = value;
    }

    const clonedErrors = Object.assign({}, formErrors);

    if (name === 'max') {
      delete clonedErrors.min;
    }

    if (name === 'maxLength') {
      delete clonedErrors.minLength;
    }

    delete clonedErrors[name];

    dispatch({
      type: 'SET_ERRORS',
      errors: clonedErrors,
    });

    dispatch({
      type: 'ON_CHANGE',
      keys: name.split('.'),
      value: val,
      ...rest,
    });
  };
  const handleSubmit = async e => {
    e.preventDefault();

    try {
      await checkFormValidity();
      const targetUid =
        state.forTarget === 'components' ? state.targetUid : uid;

      const nextSearch = `modalType=chooseAttribute&forTarget=${
        state.forTarget
      }&targetUid=${targetUid}&headerDisplayName=${state.headerDisplayName ||
        modifiedData.name}`;

      if (state.modalType === 'contentType') {
        // Create the content type schema
        createSchema(modifiedData, state.modalType, uid);
        const nextSlug = isCreatingCT
          ? 'content-types'
          : 'component-categories';
        push({
          pathname: `/plugins/${pluginId}/${nextSlug}/${uid}`,
          search: nextSearch,
        });
      } else if (state.modalType === 'attribute') {
        addAttribute(
          modifiedData,
          state.forTarget,
          state.targetUid,
          state.actionType === 'edit',
          initialData
        );
        push({ search: nextSearch });
      } else {
        console.log('Do something with component later');
      }
      dispatch({
        type: 'RESET_PROPS',
      });
    } catch (err) {
      const errors = getYupInnerErrors(err);

      dispatch({
        type: 'SET_ERRORS',
        errors,
      });
    }
  };
  const handleToggle = () => {
    push({ search: '' });
  };
  const onClosed = () => {
    setState(initialStateData);
    dispatch({
      type: 'RESET_PROPS',
    });
  };

  const onOpened = () => {
    if (state.modalType === 'chooseAttribute') {
      attributeOptionRef.current.focus();
    }
  };

  // Display data
  const displayedAttributes = getAttributes(state.forTarget);

  // Styles
  const modalBodyStyle = isPickingAttribute
    ? { paddingTop: '0.5rem', paddingBottom: '3rem' }
    : {};

  return (
    <Modal
      isOpen={isOpen}
      onOpened={onOpened}
      onClosed={onClosed}
      onToggle={handleToggle}
    >
      <HeaderModal>
        <ModalHeader
          // name={name}
          name={state.headerDisplayName}
          headerId={headerId}
          iconType={iconType || 'contentType'}
        />
        <section>
          <HeaderModalTitle>
            <FormattedMessage
              id={getModalTitleSubHeader()}
              values={{
                type: upperFirst(
                  formatMessage({
                    id: getTrad(`attribute.${state.attributeType}`),
                  })
                ),
                name: upperFirst(state.attributeName),
              }}
            >
              {msg => <span>{upperFirst(msg)}</span>}
            </FormattedMessage>

            {!isPickingAttribute && (
              <>
                <div className="settings-tabs">
                  <HeaderModalNavContainer>
                    {NAVLINKS.map((link, index) => {
                      return (
                        <HeaderNavLink
                          isActive={state.settingType === link.id}
                          key={link.id}
                          {...link}
                          onClick={() => {
                            setState(prev => ({
                              ...prev,
                              settingType: link.id,
                            }));
                            push({ search: getNextSearch(link.id) });
                          }}
                          nextTab={
                            index === NAVLINKS.length - 1 ? 0 : index + 1
                          }
                        />
                      );
                    })}
                  </HeaderModalNavContainer>
                </div>
                <hr />
              </>
            )}
          </HeaderModalTitle>
        </section>
      </HeaderModal>
      <form onSubmit={handleSubmit}>
        <ModalForm>
          <ModalBody style={modalBodyStyle}>
            <div className="container-fluid">
              {isPickingAttribute
                ? displayedAttributes.map((row, i) => {
                    return (
                      <div key={i} className="row">
                        {i === 1 && (
                          <hr
                            style={{
                              width: 'calc(100% - 30px)',
                              marginBottom: 25,
                            }}
                          />
                        )}
                        {row.map((attr, index) => {
                          const tabIndex =
                            i === 0
                              ? index
                              : displayedAttributes[0].length + index;

                          return (
                            <AttributeOption
                              key={attr}
                              tabIndex={tabIndex}
                              isDisplayed
                              onClick={() => {}}
                              ref={
                                i === 0 && index === 0
                                  ? attributeOptionRef
                                  : null
                              }
                              type={attr}
                            />
                          );
                        })}
                      </div>
                    );
                  })
                : form(modifiedData, state.attributeType).items.map(
                    (row, index) => {
                      return (
                        <div className="row" key={index}>
                          {row.map(input => {
                            if (input.type === 'divider') {
                              return (
                                <div
                                  className="col-12"
                                  style={{
                                    marginBottom: '1.7rem',
                                    marginTop: -2,
                                    fontWeight: 500,
                                  }}
                                  key="divider"
                                >
                                  <FormattedMessage
                                    id={getTrad(
                                      'form.attribute.item.settings.name'
                                    )}
                                  />
                                </div>
                              );
                            }

                            if (input.type === 'relation') {
                              return (
                                <RelationForm
                                  key="relation"
                                  mainBoxHeader={state.headerDisplayName}
                                  modifiedData={modifiedData}
                                  naturePickerType={state.forTarget}
                                  onChange={handleChange}
                                  errors={formErrors}
                                />
                              );
                            }

                            const errorId = get(
                              formErrors,
                              [...input.name.split('.'), 'id'],
                              null
                            );

                            const retrievedValue = get(
                              modifiedData,
                              input.name,
                              ''
                            );

                            let value;

                            if (
                              input.name === 'default' &&
                              state.attributeType === 'boolean'
                            ) {
                              value = toString(retrievedValue);
                            } else if (
                              input.name === 'enum' &&
                              Array.isArray(retrievedValue)
                            ) {
                              value = retrievedValue.join('\n');
                            } else {
                              value = retrievedValue;
                            }

                            if (input.type === 'addon') {
                              return (
                                <InputsIndex
                                  key={input.name}
                                  {...input}
                                  type="string"
                                  onChange={handleChange}
                                  value={value}
                                />
                              );
                            }

                            return (
                              <div
                                className={`col-${input.size || 6}`}
                                key={input.name}
                              >
                                <Inputs
                                  customInputs={{
                                    // addon: InputsIndex,
                                    customCheckboxWithChildren: CustomCheckbox,
                                    booleanBox: BooleanBox,
                                  }}
                                  value={value}
                                  {...input}
                                  error={
                                    isEmpty(errorId)
                                      ? null
                                      : formatMessage({ id: errorId })
                                  }
                                  onChange={handleChange}
                                  onBlur={() => {}}
                                  description={
                                    get(input, 'description.id', null)
                                      ? formatMessage(input.description)
                                      : input.description
                                  }
                                  placeholder={
                                    get(input, 'placeholder.id', null)
                                      ? formatMessage(input.placeholder)
                                      : input.placeholder
                                  }
                                  label={
                                    get(input, 'label.id', null)
                                      ? formatMessage(input.label)
                                      : input.label
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  )}
            </div>
          </ModalBody>
        </ModalForm>
        {!isPickingAttribute && (
          <ModalFooter>
            <section>
              <ButtonModal
                message="components.popUpWarning.button.cancel"
                onClick={handleToggle}
                isSecondary
              />
              <ButtonModal message="form.button.done" type="submit" />
            </section>
          </ModalFooter>
        )}
      </form>
    </Modal>
  );
};

export default FormModal;
